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

const stream = require('stream');

class ReplayableStream extends stream.Stream {
  constructor(options) {
    super(options);

    this.writable = true;
    this.readable = true;

    this._ended = false;

    this._chunks = [];
    this._destinations = [];
  }

  write(chunk) {
    this._chunks.push(chunk);

    this._destinations.forEach(function(destination) {
      destination.write(chunk);
    });
  }

  pipe(destination) {
    this._chunks.forEach(function(chunk) {
      destination.write(chunk);
    });

    if (this._ended) {
      destination.end();
    } else {
      this._destinations.push(destination);
    }

    return destination;
  }

  getLength() {
    return this._chunks.reduce(function(totalLength, chunk) {
      return totalLength + chunk.length;
    }, 0);
  }

  end() {
    this._destinations.forEach(function(destination) {
      destination.end();
    });

    this._destinations = [];
    this._ended = true;
  }
}

module.exports = ReplayableStream;
