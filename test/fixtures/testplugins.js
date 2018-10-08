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

const assert = require('assert');
const BasePlugin = require('../../plugins/base.js');

const ME = process.env.cloudant_username || 'nodejs';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;

// NoopPlugin for testing

class NoopPlugin extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);
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

NoopPlugin.id = 'noop';

class NoopPlugin1 extends NoopPlugin {}
NoopPlugin1.id = 'noop1';

class NoopPlugin2 extends NoopPlugin {}
NoopPlugin2.id = 'noop2';

class NoopPlugin3 extends NoopPlugin {}
NoopPlugin3.id = 'noop3';

// AlwaysRetry for testing
//   - onRequest:  noop
//   - onError:    always retries (with retry delay)
//   - onResponse: always retries (with retry delay)

class AlwaysRetry extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);
    this.onRequestCallCount = 0;
    this.onErrorCallCount = 0;
    this.onResponseCallCount = 0;
  }

  onError(state, error, callback) {
    this.onErrorCallCount++;
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelayMsecs = 500;
    } else {
      state.retryDelayMsecs *= 2;
    }
    callback(state);
  }

  onResponse(state, response, callback) {
    this.onResponseCallCount++;
    state.retry = true;
    if (state.attempt === 1) {
      state.retryDelayMsecs = 500;
    } else {
      state.retryDelayMsecs *= 2;
    }
    callback(state);
  }
}

AlwaysRetry.id = 'alwaysretry';

// ComplexPlugin1 for testing
//   - onRequest:  sets method to 'PUT'
//                 adds 'ComplexPlugin1: foo' header
//   - onError:    always retries
//   - onResponse: always retries with retry delay

class ComplexPlugin1 extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);
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
      state.retryDelayMsecs = 10;
    } else {
      state.retryDelayMsecs *= 2;
    }
    callback(state);
  }
}

ComplexPlugin1.id = 'complexplugin1';

// ComplexPlugin2 for testing
//   - onRequest:  sets method to 'GET'
//                 adds 'ComplexPlugin2: bar' header
//   - onError:    submits GET /bar and returns response
//   - onResponse: retries 401 responses once

class ComplexPlugin2 extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);
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

ComplexPlugin2.id = 'complexplugin2';

// ComplexPlugin3 for testing
//   - onResponse: retries 5xx responses once, submitting a DELETE /bar on failure

class ComplexPlugin3 extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);
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

ComplexPlugin3.id = 'complexplugin3';

// PluginA for testing
//  - attempt 1
//      * retryDelayMsecs set to 10
//  - attempt 2
//      * retryDelayMsecs set to 100
//  - attempt 3
//      * retryDelayMsecs set to 1000

class PluginA extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 0);
        assert.equal(typeof state.stash.foo, 'undefined');
        state.retry = true;
        state.retryDelayMsecs = 10;
        state.stash.foo = 'pluginA -- this hook has been called once';
        break;
      case 2:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 40);
        assert.equal(state.stash.foo, 'pluginA -- this hook has been called once');
        state.retryDelayMsecs = 100;
        state.stash.foo = 'pluginA -- this hook has been called twice';
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 400);
        assert.equal(state.stash.foo, 'pluginA -- this hook has been called twice');
        state.retryDelayMsecs = 1000;
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

PluginA.id = 'pluginA';

// PluginB for testing
//  - attempt 1
//      * retryDelayMsecs set to 20
//  - attempt 2
//      * retryDelayMsecs set to 200
//  - attempt 3
//      * retryDelayMsecs set to 2000

class PluginB extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 10);
        assert.equal(typeof state.stash.foo, 'undefined');
        state.retryDelayMsecs = 20;
        state.stash.foo = 'pluginB -- this hook has been called once';
        break;
      case 2:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 100);
        assert.equal(state.stash.foo, 'pluginB -- this hook has been called once');
        state.retry = true;
        state.retryDelayMsecs = 200;
        state.stash.foo = 'pluginB -- this hook has been called twice';
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 1000);
        assert.equal(state.stash.foo, 'pluginB -- this hook has been called twice');
        state.retryDelayMsecs = 2000;
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

PluginB.id = 'pluginB';

// PluginC for testing
//  - attempt 1
//      * retryDelayMsecs set to 30
//  - attempt 2
//      * retryDelayMsecs set to 300
//  - attempt 3
//      * retryDelayMsecs set to 3000

class PluginC extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 20);
        assert.equal(typeof state.stash.foo, 'undefined');
        state.retryDelayMsecs = 30;
        state.stash.foo = 'pluginC -- this hook has been called once';
        break;
      case 2:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 200);
        assert.equal(state.stash.foo, 'pluginC -- this hook has been called once');
        state.retryDelayMsecs = 300;
        state.stash.foo = 'pluginC -- this hook has been called twice';
        break;
      case 3:
        assert.equal(state.retry, false);
        assert.equal(state.retryDelayMsecs, 2000);
        assert.equal(state.stash.foo, 'pluginC -- this hook has been called twice');
        state.retry = true;
        state.retryDelayMsecs = 3000;
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

PluginC.id = 'pluginC';

// PluginD for testing
//  - attempt 1
//      * retryDelayMsecs set to 40
//  - attempt 2
//      * retryDelayMsecs set to 400
//  - attempt 3
//      * <no action taken>

class PluginD extends BasePlugin {
  _hook(state, callback) {
    switch (state.attempt) {
      case 1:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 30);
        assert.equal(typeof state.stash.foo, 'undefined');
        state.retryDelayMsecs = 40;
        state.stash.foo = 'pluginD -- this hook has been called once';
        break;
      case 2:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 300);
        assert.equal(state.stash.foo, 'pluginD -- this hook has been called once');
        state.retryDelayMsecs = 400;
        state.stash.foo = 'pluginD -- this hook has been called twice';
        break;
      case 3:
        assert.equal(state.retry, true);
        assert.equal(state.retryDelayMsecs, 3000);
        assert.equal(state.stash.foo, 'pluginD -- this hook has been called twice');
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

PluginD.id = 'pluginD';

module.exports = {
  NoopPlugin: NoopPlugin,
  NoopPlugin1: NoopPlugin1,
  NoopPlugin2: NoopPlugin2,
  NoopPlugin3: NoopPlugin3,
  AlwaysRetry: AlwaysRetry,
  ComplexPlugin1: ComplexPlugin1,
  ComplexPlugin2: ComplexPlugin2,
  ComplexPlugin3: ComplexPlugin3,
  PluginA: PluginA,
  PluginB: PluginB,
  PluginC: PluginC,
  PluginD: PluginD
};
