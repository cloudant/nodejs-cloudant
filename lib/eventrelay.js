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

const debug = require('debug')('cloudant:eventrelay');

/**
 * Relay all events from a source emitter to a target emitter.
 *
 * @param {Object} source - Source event emitter.
 * @param {Object} target - Target event emitter.
 */
class EventRelay {
  constructor(source, target) {
    var self = this;

    if (typeof target === 'undefined') {
      self._target = source;
    } else {
      self._target = target;
      self.setSource(source);
    }

    self._paused = true;
    self._eventsStash = [];
  }

  // Clear all stashed events.
  clear() {
    this._eventsStash = [];
  }

  // Pause event relay.
  pause() {
    this._paused = true;
  }

  // Resume event relay and fire all stashed events.
  resume() {
    var self = this;

    this._paused = false;

    debug('Relaying captured events to target stream.');
    self._eventsStash.forEach(function(event) {
      self._target.emit.apply(self._target, event);
    });
  }

  // Set a new source event emitter.
  setSource(source) {
    var self = this;

    self.clear();
    self.pause();

    debug('Setting new source stream.');
    self._source = source;

    self._oldEmit = self._source.emit;
    self._source.emit = function() {
      if (self._paused) {
        self._eventsStash.push(arguments);
      } else {
        self._target.emit.apply(self._target, arguments);
      }
      self._oldEmit.apply(self._source, arguments);
    };
  }
}

module.exports = EventRelay;
