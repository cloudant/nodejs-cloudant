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
const fs = require('fs');
const stream = require('stream');

const ReplayableStream = require('../lib/replayablestream.js');

function streamToString(stream, callback) {
  var chunks = [];
  stream.on('data', (chunk) => {
    chunks.push(chunk.toString());
  });
  stream.on('end', () => {
    callback(chunks.join(''));
  });
}

describe('Replayable Stream', function() {
  it('is replayable', function(done) {
    var rstream = new ReplayableStream();
    fs.createReadStream('test/fixtures/data.txt').pipe(rstream);

    // read the stream...
    var reader1 = new stream.PassThrough();
    rstream.pipe(reader1);

    streamToString(reader1, function(data) {
      assert.equal(data, 'The quick brown fox jumps over the lazy dog.\n'.repeat(100));

      // read the stream again...
      var reader2 = new stream.PassThrough();
      rstream.pipe(reader2);

      streamToString(reader2, function(data) {
        assert.equal(data, 'The quick brown fox jumps over the lazy dog.\n'.repeat(100));

        // and again...
        var reader3 = new stream.PassThrough();
        rstream.pipe(reader3);

        streamToString(reader3, function(data) {
          assert.equal(data, 'The quick brown fox jumps over the lazy dog.\n'.repeat(100));

          // and again...
          var reader4 = new stream.PassThrough();
          rstream.pipe(reader4);

          streamToString(reader4, function(data) {
            assert.equal(data, 'The quick brown fox jumps over the lazy dog.\n'.repeat(100));
            done();
          });
        });
      });
    });
  });
});
