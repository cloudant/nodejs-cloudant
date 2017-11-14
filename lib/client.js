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
const EventRelay = require('./eventrelay.js');
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
class CloudantClient {
  constructor(cfg) {
    var self = this;

    cfg = cfg || {};
    self._supportLegacyKeys(cfg);
    self._cfg = self._default_cfg = Object.assign({}, DEFAULTS, cfg);

    // support legacy options
    if (typeof self._cfg.maxAttempt === 'undefined') {
      self._cfg.maxAttempt = self._cfg.retryAttempts;
    }
    if (typeof self._cfg.retryInitialDelayMsecs === 'undefined') {
      self._cfg.retryInitialDelayMsecs = self._cfg.retryTimeout;
    }

    var client;
    self._plugins = [];
    self._pluginIds = [];
    self._usePromises = false;
    self.useLegacyPlugin = false;

    // build plugin array
    var plugins = [];
    if (typeof this._cfg.plugin === 'undefined' && typeof this._cfg.plugins === 'undefined') {
      plugins = ['cookieauth']; // default
    } else {
      [].concat(self._cfg.plugin).concat(self._cfg.plugins).forEach(function(plugin) {
        if (typeof plugin === 'function' && !(plugin._pluginVersion >= 2)) {
          if (self.useLegacyPlugin) {
            throw new Error('Using multiple legacy plugins in not supported');
          } else {
            debug('Using legacy plugin.');
            self.useLegacyPlugin = true;
            client = plugin; // use legacy plugin as client
            return;
          }
        }
        plugins.push(plugin);
      });
    }

    // initialize the internal client
    self._initClient(client);

    // add plugins
    self.addPlugins(plugins);
  }

  _initClient(client) {
    if (typeof client !== 'undefined') {
      debug('Using custom client.');
      this._client = client;
      return;
    }

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

    debug('Using request options: %j', requestDefaults);

    this.requestDefaults = requestDefaults; // expose request defaults
    this._client = require('request').defaults(requestDefaults);
  }

  _doPromisesRequest(options, callback) {
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
  }

  _doRequest(options, callback) {
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

    request.eventRelay = new EventRelay(request.clientStream);

    request.plugins = self._plugins;

    // init state
    request.state = {
      attempt: 0,
      cfg: self._cfg,
      // following are editable by plugin hooks during execution
      abortWithResponse: undefined,
      retry: false,
      retryDelayMsecs: 0
    };

    // add plugin stash
    request.plugin_stash = {};
    request.plugins.forEach(function(plugin) {
      // allow plugin hooks to share data via the request state
      request.plugin_stash[plugin.id] = {};
    });

    request.clientStream.abort = function() {
      // aborts response during hook execution phase.
      // note that once a "good" request is made, this abort function is
      // monkey-patched with `request.abort()`.
      request.abort = true;
    };

    var noClientCallback = typeof request.clientCallback === 'undefined';

    if (!noClientCallback) {
      // disable event piping if the client has specified a callback
      request.eventRelay.disablePiping();
    }

    async.forever(function(done) {
      request.options = Object.assign({}, options); // new copy
      request.response = undefined;

      // update state
      request.state.attempt++;
      request.state.retry = false;
      request.state.sending = false;

      debug(`Request attempt: ${request.state.attempt}`);

      utils.runHooks('onRequest', request, request.options, function(err) {
        utils.processState(request, function(stop) {
          if (request.state.retry) {
            debug('The onRequest hook issued retry.');
            return done();
          }
          if (stop) {
            debug(`The onRequest hook issued abort: ${stop}`);
            return done(stop);
          }

          debug(`Delaying request for ${request.state.retryDelayMsecs} Msecs.`);

          setTimeout(function() {
            if (request.abort) {
              debug('Client issued abort during plugin execution.');
              return done(new Error('Client issued abort'));
            }

            // do request
            request.state.sending = true; // indicates onRequest hooks completed

            debug('Submitting request: %j', request.options);

            request.response = self._client(
              request.options, utils.wrapCallback(request, done));

            // define new source on event relay
            request.eventRelay.setSource(request.response);

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
  }

  _supportLegacyKeys(cfg) {
    // retryAttempts (old) -> maxAttempt (new)
    if (typeof cfg.maxAttempt === 'undefined' && typeof cfg.retryAttempts !== 'undefined') {
      cfg.maxAttempt = cfg.retryAttempts;
    }
    // retryTimeout (old) -> retryInitialDelayMsecs (new)
    if (typeof cfg.retryInitialDelayMsecs === 'undefined' && typeof cfg.retryTimeout !== 'undefined') {
      cfg.retryInitialDelayMsecs = cfg.retryTimeout;
    }
  }

  // public

  /**
   * Add plugins to this Cloudant client.
   *
   * @param {Object[]} plugins - Array of plugins to add.
   */
  addPlugins(plugins) {
    var self = this;

    if (!Array.isArray(plugins)) {
      plugins = [plugins];
    }

    plugins.forEach(function(Plugin) {
      if (typeof Plugin === 'undefined') {
        return;
      }

      // handle legacy plugins
      if (Plugin === 'base' || Plugin === 'default') {
        return; // ignore plugins
      }
      if (Plugin === 'promises') {
        // maps this.request -> this.doPromisesRequest
        debug('Adding plugin promises.');
        self._cfg.usePromises = true;
        return;
      }

      if (typeof Plugin === 'string') {
        Plugin = require('../plugins/' + Plugin);
      }

      if (self._pluginIds.indexOf(Plugin.id) !== -1) {
        debug(`Not adding duplicate plugin: '${Plugin.id}'`);
      } else {
        debug(`Adding plugin: '${Plugin.id}'`);
        self._plugins.push(new Plugin(self._client, Object.assign({}, self._cfg)));
        self._pluginIds.push(Plugin.id);
      }
    });
  }

  /**
   * Perform a request using this Cloudant client.
   *
   * @param {Object} options - HTTP options.
   * @param {Object} cfg - Request client configuration (optional).
   * @param {requestCallback} callback - The callback that handles the response.
   */
  request(options, cfg, callback) {
    if (typeof cfg !== 'object') {
      callback = cfg;
      this._cfg = this._default_cfg; // use default
    } else {
      ['https', 'plugin', 'plugins', 'requestDefaults'].forEach(function(key) {
        if (key in cfg) {
          throw new Error(`Cannot specify '${key}' at request time`);
        }
      });
      this._supportLegacyKeys(cfg);
      this._cfg = Object.assign({}, this._default_cfg, cfg);
    }
    if (this._cfg.usePromises) {
      return this._doPromisesRequest(options, callback);
    } else {
      return this._doRequest(options, callback);
    }
  }
}

module.exports = CloudantClient;
