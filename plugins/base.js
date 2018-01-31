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

const debug = require('debug')('cloudant:plugins:base');
const lockFile = require('lockfile');
const tmp = require('tmp');

function noop() {}

/**
 * Cloudant base plugin.
 *
 * @param {Object} client - HTTP client.
 * @param {Object} cfg - Client configuration.
 */
class BasePlugin {
  constructor(client, cfg) {
    this._client = client;
    this._cfg = cfg;
    this._lockFile = tmp.tmpNameSync({ postfix: '.lock' });
  }

  get id() {
    return this.constructor.id;
  }

  // NOOP Base Hooks

  onRequest(state, request, callback) {
    callback(state);
  }

  onResponse(state, response, callback) {
    callback(state);
  }

  onError(state, error, callback) {
    callback(state);
  }

  // Helpers

  // Acquire a file lock on the specified path. Release the file lock on
  // completion of the callback.
  withLock(opts, callback) {
    var self = this;
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    debug('Acquiring lock...');
    lockFile.lock(self._lockFile, opts, function(error) {
      if (error) {
        callback(error, noop);
      } else {
        callback(null, function() {
          // Close and unlink the file lock.
          lockFile.unlock(self._lockFile, function(error) {
            if (error) {
              debug(`Failed to release lock: ${error}`);
            }
          });
        });
      }
    });
  }
}

BasePlugin.id = 'base';
BasePlugin.pluginVersion = 2;

module.exports = BasePlugin;
