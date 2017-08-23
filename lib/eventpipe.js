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

/**
 * Pipe all events from a source emitter to a target emitter.
 *
 * @param {Object} source - Source event emitter.
 * @param {Object} target - Target event emitter.
 * @param {boolean} pipeData - Attach source stream to target stream on resume.
 */
class EventPipe {
  constructor(source, target, pipeData) {
    var self = this;

    self._source = source || {};
    self._target = target;

    self._eventsStash = [];
    self._paused = true;
    self._pipeData = pipeData || false; // default: false

    self.clear();

    // monkey-patch the source emit function
    var oldEmit = self._source.emit;
    self._source.emit = function() {
      var args = arguments;
      if (self._pipeData) {
        if (args[0] === 'response') {
          // will resume flow when client calls `EventPipe.resume()`
          self._source.pause();
        } else if (['data', 'end'].indexOf(args[0]) !== -1) {
          // don't emit on target as data is pushed via pipe
          return oldEmit.apply(self._source, arguments);
        }
      }
      if (self._paused) {
        self._eventsStash.push(args); // stash event
      } else {
        self._target.emit.apply(self._target, args);
      }
      oldEmit.apply(self._source, arguments);
    };
  }

  // Clear all stashed events.
  clear() {
    this._eventsStash = [];
  }

  // Pause event pipe.
  pause() {
    this._paused = true;
  }

  // Resume event pipe and fire all stashed events.
  resume() {
    var self = this;
    self._paused = false;

    if (self._pipeData) {
      self._source.pipe(self._target);
      self._source.resume();
    }

    var eventNames;
    if (typeof self._target.eventNames !== 'undefined') {
      eventNames = self._target.eventNames();
    }

    self._eventsStash.forEach(function(event) {
      if (typeof eventNames === 'undefined' || eventNames.indexOf(event[0]) !== -1) {
        self._target.emit.apply(self._target, event);
      }
    });
  }
}

module.exports = EventPipe;
