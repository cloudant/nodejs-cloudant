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

const assert = require('assert');
const BasePlugin = require('../../plugins/base.js');

const ME = process.env.cloudant_username || 'nodejs';
const SERVER = `https://${ME}.cloudant.com`;

// NoopPlugin for testing

class NoopPlugin extends BasePlugin {
  constructor(client, opts) {
    super(client, opts);
    this.onRequestCallCount = 0;
    this.onErrorCallCount = 0;
    this.onResponseCallCount = 0;
  }

  onRequest(state, request, callback) {
    this.onRequestCallCount++;
    callback(state); // noop
  }

  onError(state, error, callback) {
    this.onErrorCallCount++;
    callback(state); // noop
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    callback(state); // noop
  }
}

// AlwaysRetry for testing
//   - onRequest:  noop
//   - onError:    always retries (with retry delay)
//   - onResponse: always retries (with retry delay)

class AlwaysRetry extends BasePlugin {
  constructor(client, opts) {
    super(client, opts);
    this.onRequestCallCount = 0;
    this.onErrorCallCount = 0;
    this.onResponseCallCount = 0;
  }

  onError(state, error, callback) {
    this.onErrorCallCount++;
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelay = 500;
    } else {
      state.retryDelay *= 2;
    }
    callback(state);
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelay = 500;
    } else {
      state.retryDelay *= 2;
    }
    callback(state);
  }
}

// AlwaysRetry for testing
//   - onRequest:  noop
//   - onError:    always retries (with retry delay)
//   - onResponse: always retries (with retry delay)

function AlwaysRetry(client, opts) {
  AlwaysRetry.super_.apply(this, arguments);
  this.onRequestCallCount = 0;
  this.onErrorCallCount = 0;
  this.onResponseCallCount = 0;
}
AlwaysRetry.super_ = BasePlugin;
AlwaysRetry.prototype = Object.create(BasePlugin.prototype);

AlwaysRetry.prototype.onError = function(state, error, callback) {
  this.onErrorCallCount++;
  state.retry = true;
  if (state.attempt === 1) {
    state.retryDelay = 500;
  } else {
    state.retryDelay *= 2;
  }
  callback(state);
};
AlwaysRetry.prototype.onResponse = function(state, response, callback) {
  this.onResponseCallCount++;
  state.retry = true;
  if (state.attempt === 1) {
    state.retryDelay = 500;
  } else {
    state.retryDelay *= 2;
  }
  callback(state);
};

// ComplexPlugin1 for testing
//   - onRequest:  sets method to 'PUT'
//                 adds 'ComplexPlugin1: foo' header
//   - onError:    always retries
//   - onResponse: always retries with retry delay

class ComplexPlugin1 extends BasePlugin {
  constructor(client, opts) {
    super(client, opts);
    this.onRequestCallCount = 0;
    this.onErrorCallCount = 0;
    this.onResponseCallCount = 0;
  }

  onRequest(state, request, callback) {
    this.onRequestCallCount++;
    request.method = 'PUT';
    request.headers = { 'ComplexPlugin1': 'foo' };
    callback(state);
  }

  onError(state, error, callback) {
    this.onErrorCallCount++;
    state.retry = true;
    callback(state);
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelay = 10;
    } else {
      state.retryDelay *= 2;
    }
    callback(state);
  }
}

// ComplexPlugin2 for testing
//   - onRequest:  sets method to 'GET'
//                 adds 'ComplexPlugin2: bar' header
//   - onError:    submits GET /bar and returns response
//   - onResponse: retries 401 responses once

class ComplexPlugin2 extends BasePlugin {
  constructor(client, opts) {
    super(client, opts);
    this.onRequestCallCount = 0;
    this.onErrorCallCount = 0;
    this.onResponseCallCount = 0;
  }

  onRequest(state, request, callback) {
    this.onRequestCallCount++;
    request.method = 'GET';
    request.headers = { 'ComplexPlugin2': 'bar' };
    callback(state);
  }

  onError(state, error, callback) {
    this.onErrorCallCount++;
    this._client(SERVER + '/bar', function(error, response, body) {
      state.abortWithResponse = [error, response, body];
      callback(state);
    });
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    if (state.attempt < state.maxAttempt) {
      if (state.attempt === 1 && response.statusCode === 401) {
        state.retry = true;
      }
    }
    callback(state);
  }
}

// ComplexPlugin3 for testing
//   - onResponse: retries 5xx responses once, submitting a DELETE /bar on failure

class ComplexPlugin3 extends BasePlugin {
  constructor(client, opts) {
    super(client, opts);
    this.onResponseCallCount = 0;
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    if (response.statusCode < 500) {
      return callback(state);
    }
    if (state.attempt === 1) {
      state.retry = true;
      callback(state);
    } else {
      var options = { url: SERVER + '/bar', method: 'DELETE' };
      this._client(options, function(error, response, body) {
        state.abortWithResponse = [error, response, body];
        callback(state);
      });
    }
  }
}

// PluginA for testing
//  - attempt 1
//      * retryDelay set to 10
//  - attempt 2
//      * retryDelay set to 100
//  - attempt 3
//      * retryDelay set to 1000

class PluginA extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 0);
        state.retry = true;
        state.retryDelay = 10;
        break;
      case 2:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 40);
        state.retryDelay = 100;
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 400);
        state.retryDelay = 1000;
        break;
      default:
        assert.fail('Too many attempts');
    }
    callback(state);
  }

  onError(state, error, callback) {
    this._hook(state, callback);
  }

  onResponse(state, response, callback) {
    this._hook(state, callback);
  }
}

// PluginB for testing
//  - attempt 1
//      * retryDelay set to 20
//  - attempt 2
//      * retryDelay set to 200
//  - attempt 3
//      * retryDelay set to 2000

class PluginB extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 10);
        state.retryDelay = 20;
        break;
      case 2:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 100);
        state.retry = true;
        state.retryDelay = 200;
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 1000);
        state.retryDelay = 2000;
        break;
      default:
        assert.fail('Too many attempts');
    }
    callback(state);
  }

  onError(state, error, callback) {
    this._hook(state, callback);
  }

  onResponse(state, response, callback) {
    this._hook(state, callback);
  }
}

// PluginC for testing
//  - attempt 1
//      * retryDelay set to 30
//  - attempt 2
//      * retryDelay set to 300
//  - attempt 3
//      * retryDelay set to 3000

class PluginC extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 20);
        state.retryDelay = 30;
        break;
      case 2:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 200);
        state.retryDelay = 300;
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelay, 2000);
        state.retry = true;
        state.retryDelay = 3000;
        break;
      default:
        assert.fail('Too many attempts');
    }
    callback(state);
  }

  onError(state, error, callback) {
    this._hook(state, callback);
  }

  onResponse(state, response, callback) {
    this._hook(state, callback);
  }
}

// PluginD for testing
//  - attempt 1
//      * retryDelay set to 40
//  - attempt 2
//      * retryDelay set to 400
//  - attempt 3
//      * <no action taken>

class PluginD extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 30);
        state.retryDelay = 40;
        break;
      case 2:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 300);
        state.retryDelay = 400;
        break;
      case 3:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelay, 3000);
        break;
      default:
        assert.fail('Too many attempts');
    }
    callback(state);
  }

  onError(state, error, callback) {
    this._hook(state, callback);
  }

  onResponse(state, response, callback) {
    this._hook(state, callback);
  }
}

module.exports = {
  NoopPlugin: NoopPlugin,
  AlwaysRetry: AlwaysRetry,
  ComplexPlugin1: ComplexPlugin1,
  ComplexPlugin2: ComplexPlugin2,
  ComplexPlugin3: ComplexPlugin3,
  PluginA: PluginA,
  PluginB: PluginB,
  PluginC: PluginC,
  PluginD: PluginD
};
