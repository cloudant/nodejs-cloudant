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

class CloudantError extends Error {
  constructor(response, data) {
    super(`${response.statusCode} ${response.statusMessage}`);
    this._response = response;
    this._data = data;
  }

  get causedBy() {
    return this._data.caused_by;
  }

  get error() {
    return this._data.error;
  }

  get headers() {
    return this._response.headers;
  }

  get reason() {
    return this._data.reason;
  }

  get statusCode() {
    return this._response.statusCode;
  }

  get statusMessage() {
    return this._response.statusMessage;
  }
}

module.exports = CloudantError;
