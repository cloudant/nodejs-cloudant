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
const debug = require('debug')('client');
const EventPipe = require('./eventpipe.js');
const pkg = require('../package.json');
const stream = require('stream');
const utils = require('./clientutils.js');

/**
 * Create a Cloudant client for managing requests.
 *
 * @param {Object} opts - Request options.
 */
function CloudantClient(opts) {
  this._opts = opts || {};

  // support legacy options
  if (typeof this._opts.maxAttempt === 'undefined') {
    this._opts.maxAttempt = this._opts.retryAttempts;
  }
  if (typeof this._opts.retryInitialDelay === 'undefined') {
    this._opts.retryInitialDelay = this._opts.retryTimeout;
  }

  this._plugins = [];
  this._usePromises = false;

  // initialize the internal client
  this._initClient();

  // add plugins
  if (this._opts.plugin) {
    this.addPlugins(this._opts.plugin);
  }
  // alias
  if (this._opts.plugins) {
    this.addPlugins(this._opts.plugins);
  }
}

CloudantClient.prototype._initClient = function() {
  var protocol;
  if (this._opts && this._opts.https === false) {
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

  if (this._opts.requestDefaults) {
    // allow user to override defaults
    requestDefaults = Object.assign({}, requestDefaults, this._opts.requestDefaults);
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
  request.clientCallback = callback;
  request.clientStream = new stream.PassThrough();
  request.clientStream.on('error', function(err) {
    debug(err);
  });

  request.plugins = self._plugins;

  // init state
  request.state = {
    attempt: 0,
    maxAttempt: self._opts.maxAttempt || 3,
    // following are editable by plugin hooks during execution
    retry: false,
    retryDelay: 0,
    abortWithResponse: undefined
  };

  async.doUntil(function(done) {
    request.options = Object.assign({}, options); // new copy
    request.response = undefined;

    // update state
    request.state.attempt++;
    request.state.retry = false;

    async.series([
      function(callback) {
        utils.runHooks('onRequest', request, request.options, callback);
      },
      function(callback) {
        utils.processState(request, callback); // process request hook results
      }
    ], function(stop) {
      if (stop) {
        return done(stop); // request hooks failed
      }
      setTimeout(function() {
        // do request
        request.response = self._client(
          request.options, utils.wrapCallback(request, done));

        // pipe to client stream
        request.eventPipe = new EventPipe(request.response, request.clientStream);

        if (typeof request.clientCallback === 'undefined') {
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
      }, request.state.retryDelay);
    });
  }, function(stop) {
    return stop;
  });

  // return stream to client
  return request.clientStream;
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
      self._usePromises = true;
      return;
    }

    if (typeof Plugin === 'string') {
      Plugin = require('../plugins/' + Plugin);
    }

    debug(`Adding plugin '${Plugin.name}'...`);
    self._plugins.push(new Plugin(self._client, self._opts));
  });
};

/**
 * Perform a request using this Cloudant client.
 *
 * @param {Object} options - HTTP options.
 * @param {requestCallback} callback - The callback that handles the response.
 */
CloudantClient.prototype.request = function(options, callback) {
  if (this._usePromises) {
    // return a promise
    return this._doPromisesRequest(options, callback);
  } else {
    return this._doRequest(options, callback);
  }
};

module.exports = CloudantClient;
