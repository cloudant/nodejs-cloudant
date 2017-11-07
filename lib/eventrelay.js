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
      target = source;
      source = {};
    }

    self.setSource(source || {});
    self._target = target;

    self._disablePiping = false;
    self._eventsStash = [];
    self._paused = true;
    self._pipeData = false; // default

    // monkey-patch the target pipe function
    var oldPipe = self._target.pipe;
    self._target.pipe = function() {
      debug('Target stream is being piped.');
      self._pipeData = true;
      return oldPipe.apply(self._target, arguments);
    };
  }

  // Set a new source event emitter.
  setSource(source) {
    var self = this;

    if (typeof self._oldSourceEmit !== 'undefined') {
      debug('Stopped listening to old source stream');
      self._source.emit = self._oldSourceEmit;
      self.clear();
    }

    debug('Setting new source stream.');
    self._source = source;
    if (typeof source === 'undefined') {
      return;
    }

    // monkey-patch the source emit function
    self._oldSourceEmit = self._source.emit;
    self._source.emit = function() {
      var args = arguments;
      if (!self._disablePiping && self._pipeData) {
        if (args[0] === 'response') {
          // will resume flow when client calls `EventRelay.resume()`
          debug('Received \'response\' event. Pausing source stream.');
          self._source.pause();
        } else if (args[0] === 'data' || args[0] === 'end') {
          // don't emit on target as data is pushed via pipe
          return self._oldSourceEmit.apply(self._source, arguments);
        }
      }
      if (self._paused) {
        self._eventsStash.push(args); // stash event
      } else {
        self._target.emit.apply(self._target, args);
      }
      self._oldSourceEmit.apply(self._source, arguments);
    };
  }

  // Clear all stashed events.
  clear() {
    debug('Clearing all previously stashed events.');
    this._eventsStash = [];
  }

  // Disable event piping.
  disablePiping() {
    debug('Disabling piping in event relay.');
    this._disablePiping = true;
  }

  // Pause event relay.
  pause() {
    debug('Pausing event relay.');
    this._paused = true;
  }

  // Resume event relay and fire all stashed events.
  resume() {
    var self = this;
    self._paused = false;

    debug('Relaying captured events to target stream.');

    if (!self._disablePiping && self._pipeData) {
      debug('Piping data from source to target.');
      self._source.pipe(self._target);
      self._source.resume();
    } else {
      debug('Target stream is not being piped.');
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

module.exports = EventRelay;
