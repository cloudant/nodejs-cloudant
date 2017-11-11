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

const EventRelay = require('../lib/eventrelay.js');

describe('EventRelay', function() {
  it('does not throw errors for an undefined source', function() {
    var target = new stream.PassThrough();
    var er = new EventRelay(undefined, target);
    er.clear();
    er.resume();
  });

  it('relays all events from source to target', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var er = new EventRelay(source, target);

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

    er.resume(); // note EventRelay starts in 'paused' mode
  });

  it('allows source to be defined after construction', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var er = new EventRelay(target);

    er.setSource(source);

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

    er.resume(); // note EventRelay starts in 'paused' mode
  });

  it('clears events and only relays new events from source to target', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var er = new EventRelay(source, target);

    // send events
    ['one', 'two', 'three'].forEach(function(e) {
      source.emit(e, e);
    });

    er.clear();

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

    er.resume(); // note EventRelay starts in 'paused' mode
  });

  it('relays data from source to target', function(done) {
    var source = new events.EventEmitter();
    var target = new stream.PassThrough();
    var er = new EventRelay(source, target);

    source.emit('request', {url: 'http://localhost:5986'});
    source.emit('socket', {encrypted: true});
    source.emit('response', {statusCode: 123});

    // data
    var sentData = ['foo', 'bar', 'baz'];
    sentData.forEach(function(d) {
      source.emit('data', d);
    });

    source.emit('end');

    var data = [];
    var seenRequestEvent = false;
    var seenSocketEvent = false;
    var seenResponseEvent = false;

    // add event handlers
    target
      .on('request', function(req) {
        seenRequestEvent = true;
        assert.equal(req.url, 'http://localhost:5986');
      })
      .on('socket', function(socket) {
        seenSocketEvent = true;
        assert.ok(socket.encrypted);
      })
      .on('response', function(resp) {
        seenResponseEvent = true;
        assert.equal(resp.statusCode, 123);
      })
      .on('pipe', function(src) {
        assert.fail('Unexpected "pipe" event received.');
      })
      .on('data', function(d) {
        data.push(d.toString('utf8'));
      })
      .on('end', function() {
        assert.ok(seenRequestEvent);
        assert.ok(seenSocketEvent);
        assert.ok(seenResponseEvent);
        assert.deepEqual(data, sentData);
        done();
      });

    er.resume(); // note EventRelay starts in 'paused' mode
  });

  it('pipes data from source to target', function(done) {
    var source = new stream.Readable();
    source._read = function() {}; // noop read
    var target = new stream.PassThrough();

    var er = new EventRelay(source, target);

    var reader = new stream.PassThrough();
    reader.data = [];
    reader.on('data', function(data) {
      reader.data.push(data.toString('utf8'));
    });

    target.pipe(reader); // pipe to reader

    source.emit('request', {url: 'http://localhost:5986'});
    source.emit('socket', {encrypted: true});
    source.emit('response', {statusCode: 123});

    // data
    var sentData = ['foo', 'bar', 'baz'];
    sentData.forEach(function(d) {
      source.push(d);
    });

    source.push(null); // signal EOF

    var seenRequestEvent = false;
    var seenSocketEvent = false;
    var seenResponseEvent = false;
    var seenPipeEvent = false;

    // add event handlers
    target
      .on('request', function(req) {
        seenRequestEvent = true;
        assert.equal(req.url, 'http://localhost:5986');
      })
      .on('socket', function(socket) {
        seenSocketEvent = true;
        assert.ok(socket.encrypted);
      })
      .on('response', function(resp) {
        seenResponseEvent = true;
        assert.equal(resp.statusCode, 123);
      })
      .on('pipe', function(src) {
        seenPipeEvent = true;
        assert.equal(typeof src, 'object');
      })
      .on('end', function() {
        assert.ok(seenRequestEvent);
        assert.ok(seenSocketEvent);
        assert.ok(seenResponseEvent);
        assert.ok(seenPipeEvent);
        assert.deepEqual(reader.data, sentData);
        done();
      });

    er.resume(); // note EventRelay starts in 'paused' mode
  });
});
