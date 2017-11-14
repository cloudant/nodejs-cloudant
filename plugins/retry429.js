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

const BasePlugin = require('./base.js');

/**
 * Retry 429 response plugin.
 */
class Retry429Plugin extends BasePlugin {
  onResponse(state, response, callback) {
    if (response.statusCode === 429) {
      state.retry = true;
      if (state.attempt === 1) {
        state.retryDelayMsecs = state.cfg.retryInitialDelayMsecs;
      } else {
        state.retryDelayMsecs *= state.cfg.retryDelayMultiplier;
      }
    }
    callback(state);
  }
}

Retry429Plugin.id = 'retry429';

module.exports = Retry429Plugin;
