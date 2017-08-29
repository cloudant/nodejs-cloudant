// Copyright © 2017 IBM Corp. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict';

const async = require('async');
const debug = require('debug')('cloudant:client');
const EventPipe = require('./eventpipe.js');
const pkg = require('../package.json');
const stream = require('stream');
const utils = require('./clientutils.js');

const DEFAULTS = {
  maxAttempt: 3,
  retryDelayMultiplier: 2,
  retryInitialDelayMsecs: 500,
  usePromises: false
};

/**
 * Create a Cloudant client for managing requests.
 *
 * @param {Object} cfg - Request client configuration.
 */
function CloudantClient(cfg) {
  cfg = cfg || {};
  this._support_legacy_keys(cfg);
  this._cfg = this._default_cfg = Object.assign({}, DEFAULTS, cfg);

  // support legacy options
  if (typeof this._cfg.maxAttempt === 'undefined') {
    this._cfg.maxAttempt = this._cfg.retryAttempts;
  }
  if (typeof this._cfg.retryInitialDelayMsecs === 'undefined') {
    this._cfg.retryInitialDelayMsecs = this._cfg.retryTimeout;
  }

  this._plugins = [];
  this._usePromises = false;

  // initialize the internal client
  this._initClient();

  // add plugins
  this._plugins = [];
  if (this._cfg.plugin) {
    this.addPlugins(this._cfg.plugin);
  }
  if (this._cfg.plugins) {
    this.addPlugins(this._cfg.plugins);
  }
}

CloudantClient.prototype._initClient = function() {
  var protocol;
  if (this._cfg && this._cfg.https === false) {
    protocol = require('http');
  } else {
    protocol = require('https'); // default to https
  }

  var agent = new protocol.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 6
  });
  var requestDefaults = {
    agent: agent,
    gzip: true,
    headers: {
      // set library UA header
      'User-Agent': `nodejs-cloudant/${pkg.version} (Node.js ${process.version})`
    },
    jar: false
  };

  if (this._cfg.requestDefaults) {
    // allow user to override defaults
    requestDefaults = Object.assign({}, requestDefaults, this._cfg.requestDefaults);
  }

  this._client = require('request').defaults(requestDefaults);
};

CloudantClient.prototype._doPromisesRequest = function(options, callback) {
  var self = this;

  return new Promise(function(resolve, reject) {
    self._doRequest(options, function(error, response, data) {
      if (typeof callback !== 'undefined') {
        callback(error, response, data);
      }
      if (error) {
        reject(error);
      } else {
        if (data) {
          try {
            data = JSON.parse(data);
            data.statusCode = response.statusCode;
          } catch (err) {}
        } else {
          data = { statusCode: response.statusCode };
        }
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve(data);
        } else {
          reject(data);
        }
      }
    });
  });
};

CloudantClient.prototype._doRequest = function(options, callback) {
  var self = this;

  if (typeof options === 'string') {
    options = { method: 'GET', url: options };  // default GET
  }

  var request = {};
  request.abort = false;
  request.clientCallback = callback;
  request.clientStream = new stream.PassThrough();
  request.clientStream.on('error', function(err) {
    debug(err);
  });

  request.plugins = self._plugins;

  // init state
  request.state = {
    attempt: 0,
    cfg: self._cfg,
    // following are editable by plugin hooks during execution
    retry: false,
    retryDelayMsecs: 0,
    abortWithResponse: undefined
  };

  request.clientStream.abort = function() {
    // aborts response during hook execution phase.
    // note that once a "good" request is made, this abort function is
    // monkey-patched with `request.abort()`.
    request.abort = true;
  };

  var noClientCallback = typeof request.clientCallback === 'undefined';

  async.forever(function(done) {
    request.options = Object.assign({}, options); // new copy
    request.response = undefined;

    // update state
    request.state.attempt++;
    request.state.retry = false;
    request.state.sending = false;

    utils.runHooks('onRequest', request, request.options, function(err) {
      utils.processState(request, function(stop) {
        if (request.state.retry) {
          debug('onRequest hook issued retry');
          return done();
        }
        if (stop) {
          debug(`onRequest hook issued abort: ${stop}`);
          return done(stop);
        }

        debug(`delaying request for ${request.state.retryDelayMsecs} Msecs`);

        setTimeout(function() {
          if (request.abort) {
            debug('client issued abort during plugin execution');
            return done(new Error('Client issued abort'));
          }

          // do request
          request.state.sending = true; // indicates onRequest hooks completed
          request.response = self._client(
            request.options, utils.wrapCallback(request, done));

          // pipe to client stream
          request.eventPipe = new EventPipe(request.response, request.clientStream, noClientCallback);

          if (noClientCallback) {
            // run hooks using response event listener
            request.response
              .on('error', function(error) {
                utils.runHooks('onError', request, error, function() {
                  utils.processState(request, done); // process error hook results
                });
              })
              .on('response', function(response) {
                utils.runHooks('onResponse', request, response, function() {
                  utils.processState(request, done); // process response hook results
                });
              });
          }
        }, request.state.retryDelayMsecs);
      });
    });
  }, function(err) { debug(err.message); });

  return request.clientStream; // return stream to client
};

CloudantClient.prototype._support_legacy_keys = function(cfg) {
  // retryAttempts (old) -> maxAttempt (new)
  if (typeof cfg.maxAttempt === 'undefined' && typeof cfg.retryAttempts !== 'undefined') {
    cfg.maxAttempt = cfg.retryAttempts;
  }
  // retryTimeout (old) -> retryInitialDelayMsecs (new)
  if (typeof cfg.retryInitialDelayMsecs === 'undefined' && typeof cfg.retryTimeout !== 'undefined') {
    cfg.retryInitialDelayMsecs = cfg.retryTimeout;
  }
};

// public

/**
 * Add plugins to this Cloudant client.
 *
 * @param {Object[]} plugins - Array of plugins to add.
 */
CloudantClient.prototype.addPlugins = function(plugins) {
  var self = this;

  if (!Array.isArray(plugins)) {
    plugins = [plugins];
  }

  plugins.forEach(function(Plugin) {
    // handle legacy plugins
    if (Plugin === 'base' || Plugin === 'default') {
      return; // ignore plugins
    }
    if (Plugin === 'promises') {
      // maps this.request -> this.doPromisesRequest
      debug('Adding plugin promises...');
      self._cfg.usePromises = true;
      return;
    }

    if (typeof Plugin === 'string') {
      Plugin = require('../plugins/' + Plugin);
    }

    debug(`Adding plugin '${Plugin.id}'...`);
    self._plugins.push(new Plugin(self._client));
  });
};

/**
 * Perform a request using this Cloudant client.
 *
 * @param {Object} options - HTTP options.
 * @param {Object} cfg - Request client configuration (optional).
 * @param {requestCallback} callback - The callback that handles the response.
 */
CloudantClient.prototype.request = function(options, cfg, callback) {
  if (typeof cfg !== 'object') {
    callback = cfg;
    this._cfg = this._default_cfg; // use default
  } else {
    ['https', 'plugin', 'plugins', 'requestDefaults'].forEach(function(key) {
      if (key in cfg) {
        throw new Error(`Cannot specify '${key}' at request time`);
      }
    });
    this._support_legacy_keys(cfg);
    this._cfg = Object.assign({}, this._default_cfg, cfg);
  }
  if (this._cfg.usePromises) {
    return this._doPromisesRequest(options, callback);
  } else {
    return this._doRequest(options, callback);
  }
};

module.exports = CloudantClient;
