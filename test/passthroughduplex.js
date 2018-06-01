// Copyright © 2018 IBM Corp. All rights reserved.
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
const stream = require('stream');

const PassThroughDuplex = require('../lib/passthroughduplex.js');

describe('Pass Through Duplex', function() {
  it('can write to internal writable', function(done) {
    var duplex = new PassThroughDuplex();
    var readable = new stream.Readable();
    readable._read = function noop() {};

    readable.pipe(duplex);

    var data = ['data', 'some more data', 'even more data'];
    data.forEach(function(d) {
      readable.push(d);
    });
    readable.push(null);

    var chunks = [];
    duplex.passThroughWritable.on('data', function(chunk) {
      chunks.push(chunk.toString());
    });

    duplex.passThroughWritable.on('end', function() {
      assert.deepEqual(chunks, data);
      done();
    });
  });

  it('can read from internal readable', function(done) {
    var duplex = new PassThroughDuplex();
    var readable = new stream.Readable();
    readable._read = function noop() {};

    readable.pipe(duplex.passThroughReadable);

    var data = ['data', 'some more data', 'even more data'];
    data.forEach(function(d) {
      readable.push(d);
    });
    readable.push(null);

    var chunks = [];
    duplex.passThroughReadable.on('data', function(chunk) {
      chunks.push(chunk.toString());
    });

    duplex.passThroughReadable.on('end', function() {
      assert.deepEqual(chunks, data);
      done();
    });
  });

  it('captures pipe event', function(done) {
    var duplex = new PassThroughDuplex();
    var readable = new stream.Readable();

    readable._read = function noop() {
      this.push(null);
    };

    readable.pipe(duplex.passThroughReadable);

    duplex.on('pipe', function() {
      done();
    });

    readable.pipe(duplex);
  });
});
