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
 * Retry on error plugin.
 */
class RetryErrorPlugin extends BasePlugin {
  onError(state, error, callback) {
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelay = this._opts.retryInitialDelay || 500;
    } else {
      state.retryDelay *= this._opts.retryDelayMultiplier || 2;
    }
    callback(state);
  }
}

module.exports = RetryErrorPlugin;
