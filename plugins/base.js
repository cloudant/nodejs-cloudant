// Copyright © 2017, 2019 IBM Corp. All rights reserved.
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
const Mutex = require('../lib/mutex');

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
    this._mutex = new Mutex();
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

  withLock(ttl, callback) {
    var self = this;
    self._mutex.lock(ttl, function(error) {
      if (error) {
        debug(`Failed to acquire lock: ${error}`);
        callback(error, noop);
      } else {
        debug(`Acquired lock.`);
        callback(null, function() {
          self._mutex.unlock();
          debug(`Released lock.`);
        });
      }
    });
  }
}

BasePlugin.id = 'base';
BasePlugin.pluginVersion = 2;

module.exports = BasePlugin;
