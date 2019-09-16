// Copyright © 2019 IBM Corp. All rights reserved.
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

const debug = require('debug')('cloudant:mutex');

class Mutex {
  constructor() {
    this._isLocked = false;
    this._waiting = [];
  }

  get isLocked() {
    return this._isLocked;
  }

  lock(ttl, callback) {
    if (!this._isLocked) {
      this._isLocked = true;
      callback();
      return;
    }

    var timer;
    this._waiting.push(() => {
      clearTimeout(timer);

      if (!callback) {
        this.unlock();
        return;
      }

      callback();
      callback = null;
    });

    timer = setTimeout(() => {
      if (callback) {
        callback(new Error('Timed out acquiring lock.'));
        callback = null;
      }
    }, ttl);
  }

  unlock() {
    if (!this._isLocked) {
      debug('Attempted to unlock an already unlocked mutex.');
      return;
    }

    let waiter = this._waiting.shift();
    if (waiter) {
      waiter();
    } else {
      this._isLocked = false;
    }
  }
}

module.exports = Mutex;
