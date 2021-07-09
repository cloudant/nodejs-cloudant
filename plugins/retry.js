// Copyright © 2017, 2018 IBM Corp. All rights reserved.
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

const BasePlugin = require('./base.js');
const debug = require('debug')('cloudant:plugins:retry');
/**
 * Retry plugin.
 */
class RetryPlugin extends BasePlugin {
  constructor(client, cfg) {
    cfg = Object.assign({
      retryDelayMultiplier: 2,
      retryErrors: true,
      retryInitialDelayMsecs: 500,
      retryStatusCodes: [
        429, // 429 Too Many Requests
        500, // 500 Internal Server Error
        501, // 501 Not Implemented
        502, // 502 Bad Gateway
        503, // 503 Service Unavailable
        504 // 504 Gateway Timeout
      ]
    }, cfg);
    super(client, cfg);
  }

  onResponse(state, response, callback) {
    if (this._cfg.retryStatusCodes.indexOf(response.statusCode) !== -1) {
      debug(`Received status code ${response.statusCode}; setting retry state.`);
      state.retry = true;
      if (state.attempt === 1) {
        state.retryDelayMsecs = this._cfg.retryInitialDelayMsecs;
      } else {
        state.retryDelayMsecs *= this._cfg.retryDelayMultiplier;
      }
      debug(`Asking for retry after ${state.retryDelayMsecs}`);
    }
    callback(state);
  }

  onError(state, error, callback) {
    if (this._cfg.retryErrors) {
      debug(`Received error ${error.code} ${error.message}; setting retry state.`);
      state.retry = true;
      if (state.attempt === 1) {
        state.retryDelayMsecs = this._cfg.retryInitialDelayMsecs;
      } else {
        state.retryDelayMsecs *= this._cfg.retryDelayMultiplier;
      }
      debug(`Asking for retry after ${state.retryDelayMsecs}`);
    }
    callback(state);
  }
}

RetryPlugin.id = 'retry';

module.exports = RetryPlugin;
