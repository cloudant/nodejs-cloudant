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

/* global describe it afterEach */
'use strict';

const assert = require('assert');
const nock = require('./nock.js');
const request = require('request');
const stream = require('stream');
const testPlugin = require('./fixtures/testplugins.js');
const utils = require('../lib/clientutils.js');

const ME = process.env.cloudant_username || 'nodejs';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;

describe('Client Utilities', function() {
  afterEach(function() {
    if (!process.env.NOCK_OFF) {
      nock.cleanAll();
    }
  });

  describe('processState', function() {
    it('calls back without error if no response', function(done) {
      var r = { clientStream: {}, response: undefined, state: { retry: false } };
      utils.processState(r, function(stop) {
        assert.equal(stop, undefined);
        done();
      });
    });

    it('calls back without error if retry', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        maxAttempt: 3,
        retry: true,
        sending: true
      };
      utils.processState(r, function(stop) {
        assert.equal(stop, undefined);
        done();
      });
    });

    it('calls back with error if plugin issued abort', function(done) {
      var r = {
        clientCallback: function(e, r, d) {
          assert.equal(e, 'error');
          assert.equal(r, 'response');
          assert.equal(d, 'data');
        },
        clientStream: new stream.PassThrough()
      };

      r.clientStream.on('error', function(e) {
        assert.equal(e, 'error');
      });
      r.clientStream.on('response', function(r) {
        assert.equal(r, 'response');
      });
      r.clientStream.on('data', function(d) {
        assert.equal(d, 'data');
      });

      r.state = {
        abortWithResponse: ['error', 'response', 'data'],
        retry: false
      };
      utils.processState(r, function(stop) {
        assert.equal(stop.message, 'Plugin issued abort');
        done();
      });
    });

    it('calls back with error if too many retries', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { abort: false, clientStream: { destinations: [] }, response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 3,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: true,
        sending: true
      };
      utils.processState(r, function(stop) {
        assert.equal(stop.message, 'No retry requested');
        done();
      });
    });

    it('calls back with error if no retry', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { abort: false, clientStream: { destinations: [] }, response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: false,
        sending: true
      };
      utils.processState(r, function(stop) {
        assert.equal(stop.message, 'No retry requested');
        done();
      });
    });

    it('calls back without error if retry and sending false', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        maxAttempt: 3,
        retry: true,
        sending: false
      };
      utils.processState(r, function(stop) {
        assert.equal(stop, undefined);
        done();
      });
    });

    it('calls back without error if no retry and sending false', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { clientStream: {}, response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: false,
        sending: false
      };
      utils.processState(r, function(stop) {
        assert.equal(stop, undefined);
        done();
      });
    });

    it('calls back without error if too many retries and sending false', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var r = { clientStream: {}, response: request.get(SERVER) };
      r.state = {
        abortWithResponse: undefined,
        attempt: 3,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: true,
        sending: false
      };
      utils.processState(r, function(stop) {
        assert.equal(stop, undefined);
        assert.equal(r.state.retry, false);
        done();
      });
    });
  });

  describe('runHooks', function() {
    it('exits early if no plugins', function(done) {
      var r = { plugins: [] }; // no plugins
      utils.runHooks('onRequest', r, 'data', function(err) {
        done(err);
      });
    });

    it('runs all plugin hooks', function(done) {
      var plugin = new testPlugin.NoopPlugin(null, {});
      var r = { plugins: [ plugin ], plugin_stash: { noop: {} } };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: true,
        sending: true
      };
      utils.runHooks('onRequest', r, 'request', function(err) {
        assert.equal(plugin.onRequestCallCount, 1);
        assert.equal(plugin.onErrorCallCount, 0);
        assert.equal(plugin.onResponseCallCount, 0);
        done(err);
      });
    });

    it('noop for missing plugin hook', function(done) {
      var plugin = new testPlugin.NoopPlugin(null, {});
      var r = { plugins: [ plugin ] };
      utils.runHooks('someInvalidHookName', r, 'request', function(err) {
        assert.equal(plugin.onRequestCallCount, 0);
        assert.equal(plugin.onErrorCallCount, 0);
        assert.equal(plugin.onResponseCallCount, 0);
        done(err);
      });
    });
  });

  describe('wrapCallback', function() {
    it('noop for undefined client callback', function() {
      var r = { clientCallback: undefined }; // no client callback
      assert.equal(utils.wrapCallback(r), undefined);
    });

    it('skips error hooks and executes client callback', function(done) {
      nock(SERVER)
        .get('/')
        .reply(200, {couchdb: 'Welcome'});

      var plugin = new testPlugin.NoopPlugin(null, {});
      var cb = function(e, r, d) {
        assert.equal(e, undefined);
        assert.equal(r.statusCode, 200);
        assert.ok(d.toString('utf8').indexOf('"couchdb":"Welcome"') > -1);

        assert.equal(plugin.onRequestCallCount, 0);
        assert.equal(plugin.onErrorCallCount, 0);
        assert.equal(plugin.onResponseCallCount, 0);

        done();
      };
      var r = {
        abort: false,
        clientCallback: cb,
        clientStream: {},
        plugins: [ plugin ],
        plugin_stash: { noop: {} }
      };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        cfg: { maxAttempt: 3, retryDelay: 0 },
        retry: false,
        sending: true
      };
      r.response = request.get(SERVER, utils.wrapCallback(r));
    });

    it('runs plugin error hooks and skips client callback on retry', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      nock(SERVER)
        .get('/')
        .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var plugin = new testPlugin.NoopPlugin(null, {});
      var cb = function(e, r, d) {
        assert.fail('Unexpected client callback execution');
      };
      var r = {
        clientCallback: cb,
        plugins: [ plugin ],
        plugin_stash: { noop: {} }
      };
      r.state = {
        abortWithResponse: undefined,
        attempt: 1,
        maxAttempt: 3,
        retry: true,
        sending: true
      };
      r.response = request.get(SERVER, utils.wrapCallback(r, function(stop) {
        done(stop);
      }));
    });

    it('runs plugin error hooks and executes client callback on abort', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      nock(SERVER)
        .get('/')
        .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var plugin = new testPlugin.NoopPlugin(null, {});
      var cb = function(e, r, d) {
        assert.equal(e, 'error');
        assert.equal(r, 'response');
        assert.equal(d, 'data');

        assert.equal(plugin.onRequestCallCount, 0);
        assert.equal(plugin.onErrorCallCount, 1);
        assert.equal(plugin.onResponseCallCount, 0);
      };
      var r = {
        clientCallback: cb,
        clientStream: new stream.PassThrough(),
        plugins: [ plugin ],
        plugin_stash: { noop: {} }
      };

      r.clientStream.on('error', function(e) {
        assert.equal(e, 'error');
      });
      r.clientStream.on('response', function(r) {
        assert.equal(r, 'response');
      });
      r.clientStream.on('data', function(d) {
        assert.equal(d, 'data');
      });

      r.state = {
        abortWithResponse: ['error', 'response', 'data'],
        retry: false
      };
      r.response = request.get(SERVER, utils.wrapCallback(r, function(stop) {
        assert.equal(stop.message, 'Plugin issued abort');
        done();
      }));
    });
  });
});
