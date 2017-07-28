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

/* global describe it */
'use strict';

const assert = require('assert');
const events = require('events');
const stream = require('stream');

const EventPipe = require('../lib/eventpipe.js');

describe('EventPipe', function() {
  it('pipes all events from source to target', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var ep = new EventPipe(source, target);

    // send events
    var sentEvents = ['one', 'two', 'three'];
    sentEvents.forEach(function(e) {
      source.emit(e, e);
    });

    // add event handlers
    var receivedEvents = [];
    target
      .on('one', function(x) {
        receivedEvents.push(x);
      })
      .on('two', function(x) {
        receivedEvents.push(x);
      })
      .on('three', function(x) {
        receivedEvents.push(x);
        assert.deepEqual(receivedEvents, sentEvents);
        done();
      });

    ep.resume(); // note EventPipe starts in 'paused' mode
  });

  it('clears events and only pipes new events from source to target', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var ep = new EventPipe(source, target);

    // send events
    ['one', 'two', 'three'].forEach(function(e) {
      source.emit(e, e);
    });

    ep.clear();

    // send more events
    var sentEvents = ['four', 'five', 'six'];
    sentEvents.forEach(function(e) {
      source.emit(e, e);
    });

    // add event handlers
    var receivedEvents = [];
    target
      .on('four', function(x) {
        receivedEvents.push(x);
      })
      .on('five', function(x) {
        receivedEvents.push(x);
      })
      .on('six', function(x) {
        receivedEvents.push(x);
        assert.deepEqual(receivedEvents, sentEvents);
        done();
      });

    ep.resume(); // note EventPipe starts in 'paused' mode
  });
});
