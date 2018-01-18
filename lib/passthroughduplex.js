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
'use strict';

const stream = require('stream');

class PassThroughDuplex extends stream.Duplex {
  constructor(options) {
    super(options);

    this.destinations = [];

    this.passThroughReadable = new stream.PassThrough();
    this.passThroughReadable.on('error', function(error) {
      this.emit(error);
    });

    this.passThroughWritable = new stream.PassThrough();
    this.passThroughWritable.on('error', function(error) {
      this.emit(error);
    });
  }

  // readable

  _read(size) {
    return this.passThroughReadable._read(size);
  }

  isPaused() {
    return this.passThroughReadable.isPaused();
  }

  pause() {
    return this.passThroughReadable.pause();
  }

  pipe(destination, options) {
    this.destinations.push(destination);
    return this.passThroughReadable.pipe(destination, options);
  }

  readableHighWaterMark() {
    return this.passThroughReadable.readableHighWaterMark();
  }

  read(size) {
    return this.passThroughReadable.read(size);
  }

  resume() {
    return this.passThroughReadable.resume();
  }

  setEncoding(encoding) {
    return this.passThroughReadable.setEncoding(encoding);
  }

  unpipe(destination) {
    return this.passThroughReadable.unpipe(destination);
  }

  unshift(chunk) {
    return this.passThroughReadable.unshift(chunk);
  }

  wrap(stream) {
    return this.passThroughReadable.wrap(stream);
  }

  // writable

  _final(callback) {
    return this.passThroughWritable._final(callback);
  }

  _write(chunk, encoding, callback) {
    return this.passThroughWritable._write(chunk, encoding, callback);
  }

  _writev(chunks, callback) {
    return this.passThroughWritable._writev(chunks, callback);
  }

  cork() {
    return this.passThroughWritable.cork();
  }

  end(chunk, encoding, callback) {
    return this.passThroughWritable.end(chunk, encoding, callback);
  }

  setDefaultEncoding(encoding) {
    return this.passThroughWritable.setDefaultEncoding(encoding);
  }

  uncork() {
    return this.passThroughWritable.uncork();
  }

  writableHighWaterMark() {
    return this.passThroughWritable.writableHighWaterMark();
  }

  write(chunk, encoding, callback) {
    return this.passThroughWritable.write(chunk, encoding, callback);
  }

  // destroy

  destroy(error) {
    this.passThroughWritable.destroy(error);
    this.passThroughReadable.destroy(error);
  }

  // events

  on(event, listener) {
    if (!this.passThroughWritable) {
      return super.on(event, listener);
    }

    switch (event) {
      case 'drain':
      case 'finish':
        return this.passThroughWritable.on(event, listener);
      default:
        return super.on(event, listener);
    }
  }
}

PassThroughDuplex.addListener = PassThroughDuplex.on;

module.exports = PassThroughDuplex;
