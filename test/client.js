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

/* global describe it before after */
'use strict';

const assert = require('assert');
const Client = require('../lib/client.js');
const nock = require('./nock.js');
const testPlugin = require('./fixtures/testplugins.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = `https://${ME}.cloudant.com`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

describe('CloudantClient', function() {
  before(function(done) {
    var mocks = nock(SERVER)
        .put(DBNAME)
        .reply(201, {ok: true});

    var cloudantClient = new Client({ plugin: 'retryerror' });

    var options = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'PUT'
    };
    cloudantClient.request(options, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 201);
      mocks.done();
      done();
    });
  });

  after(function(done) {
    var mocks = nock(SERVER)
        .delete(DBNAME)
        .reply(200, {ok: true});

    var cloudantClient = new Client({ plugin: 'retryerror' });

    var options = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'DELETE'
    };
    cloudantClient.request(options, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
      mocks.done();
      done();
    });
  });

  describe('supports legacy configuration', function() {
    it('supports legacy option retryAttempts', function() {
      var cfg = { retryAttempts: 123 };
      var cloudantClient = new Client(cfg);
      cloudantClient._supportLegacyKeys(cfg);
      assert.equal(cfg.maxAttempt, 123);
    });

    it('supports legacy option retryTimeout', function() {
      var cfg = { retryTimeout: 321 };
      var cloudantClient = new Client(cfg);
      cloudantClient._supportLegacyKeys(cfg);
      assert.equal(cfg.retryInitialDelayMsecs, 321);
    });
  });

  describe('plugin support', function() {
    it('adds cookie authentication plugin if no other plugins are specified', function() {
      var cloudantClient = new Client();
      assert.equal(cloudantClient._plugins.length, 1);
      assert.equal(cloudantClient._plugins[0].id, 'cookieauth');
    });

    it('allows plugins to be added separately', function() {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.addPlugins(testPlugin.NoopPlugin1); // plugin 1
      cloudantClient.addPlugins(testPlugin.NoopPlugin2); // plugin 2
      cloudantClient.addPlugins(testPlugin.NoopPlugin3); // plugin 3
      assert.equal(cloudantClient._plugins.length, 3);
    });

    it('allows an array of plugins to be added', function() {
      var cloudantClient = new Client({ plugins: [] });
      var plugins = [testPlugin.NoopPlugin1, testPlugin.NoopPlugin2, testPlugin.NoopPlugin3];
      cloudantClient.addPlugins(plugins);
      assert.equal(cloudantClient._plugins.length, 3);
    });

    it('deduplicates plugins when added separately', function() {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.addPlugins(testPlugin.NoopPlugin); // plugin 1
      cloudantClient.addPlugins(testPlugin.NoopPlugin); // plugin 2
      cloudantClient.addPlugins(testPlugin.NoopPlugin); // plugin 3
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('deduplicates plugins when added as array', function() {
      var cloudantClient = new Client({ plugins: [] });
      var plugins = [testPlugin.NoopPlugin, testPlugin.NoopPlugin, testPlugin.NoopPlugin];
      cloudantClient.addPlugins(plugins);
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('allows a single plugin to be added via "plugin" options', function() {
      var cloudantClient = new Client({ plugin: ['cookieauth'] });
      assert.equal(cloudantClient._plugins.length, 1);
      assert.equal(cloudantClient._cfg.usePromises, false);
    });

    it('allows a single plugin to be added via "plugins" options', function() {
      var cloudantClient = new Client({ plugins: ['cookieauth'] });
      assert.equal(cloudantClient._plugins.length, 1);
      assert.equal(cloudantClient._cfg.usePromises, false);
    });

    it('allows an array of plugins to be added via "plugin" options', function() {
      var cloudantClient = new Client({
        plugin: [
          'promises', // sets cloudantClient._cfg.usePromises -> true
          'retry', // plugin 1
          'cookieauth', // plugin 2
          'default', // ignored
          'base' // ignored
        ]
      });
      assert.equal(cloudantClient._plugins.length, 2);
      assert.ok(cloudantClient._cfg.usePromises);
    });

    it('allows an array of plugins to be added via "plugins" options', function() {
      var cloudantClient = new Client({
        plugins: [
          'promises', // sets cloudantClient._cfg.usePromises -> true
          'retry', // plugin 1
          'cookieauth', // plugin 2
          'default', // ignored
          'base' // ignored
        ]
      });
      assert.equal(cloudantClient._plugins.length, 2);
      assert.ok(cloudantClient._cfg.usePromises);
    });
  });

  describe('specifying client configuration at request time', function() {
    it('errors when attempting to override https', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.throws(
        () => {
          cloudantClient.request('http://localhost:5984', { https: false });
        },
        /Cannot specify 'https' at request time/,
        'did not throw with expected message'
      );
    });

    it('errors when attempting to override plugin', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.throws(
        () => {
          cloudantClient.request('http://localhost:5984', { plugin: [ 'retry429' ] });
        },
        /Cannot specify 'plugin' at request time/,
        'did not throw with expected message'
      );
    });

    it('errors when attempting to override plugins', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.throws(
        () => {
          cloudantClient.request('http://localhost:5984', { plugins: [ 'retry429' ] });
        },
        /Cannot specify 'plugins' at request time/,
        'did not throw with expected message'
      );
    });

    it('errors when attempting to override requestDefaults', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.throws(
        () => {
          cloudantClient.request(
            'http://localhost:5984', { requestDefaults: { gzip: false } }
          );
        },
        /Cannot specify 'requestDefaults' at request time/,
        'did not throw with expected message'
      );
    });

    it('successfully overrides maxAttempt', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.addPlugins(testPlugin.AlwaysRetry);
      assert.equal(cloudantClient._plugins.length, 1);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(options, { maxAttempt: 2 }, function(err, resp, data) {
        assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('successfully overrides retryDelayMultiplier', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .times(3)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.addPlugins(testPlugin.AlwaysRetry);
      assert.equal(cloudantClient._plugins.length, 1);

      var startTs = (new Date()).getTime();
      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(options, { retryDelayMultiplier: 3 }, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        // validate retry delay
        var now = (new Date()).getTime();
        assert.ok(now - startTs > (500 + 1500));

        mocks.done();
        done();
      });
    });

    it('successfully overrides retryInitialDelayMsecs', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .times(3)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.addPlugins(testPlugin.AlwaysRetry);
      assert.equal(cloudantClient._plugins.length, 1);

      var startTs = (new Date()).getTime();
      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(options, { retryInitialDelayMsecs: 750 }, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        // validate retry delay
        var now = (new Date()).getTime();
        assert.ok(now - startTs > (750 + 1500));

        mocks.done();
        done();
      });
    });

    it('successfully overrides usePromises', function(done) {
      var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: [] });
      assert.equal(cloudantClient._plugins.length, 0);
      assert.equal(cloudantClient._cfg.usePromises, false);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      var p = cloudantClient.request(options, { usePromises: true }).then(function(data) {
        assert.equal(data.doc_count, 0);
        mocks.done();
        done();
      }).catch(function(err) {
        assert.fail(`Unexpected reject: ${err}`);
      });
      assert.ok(p instanceof Promise);
    });
  });

  describe('aborts request', function() {
    it('during plugin execution phase', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .times(4)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({
        maxAttempt: 5,
        plugin: testPlugin.AlwaysRetry
      });
      assert.equal(cloudantClient._plugins.length, 1);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      var resp = cloudantClient.request(options, function() {
        assert.fail('Unexpected callback execution by Cloudant client');
      });

      // allow enough time for 4 retry attempts
      setTimeout(function() { resp.abort(); }, 500 + 1000 + 2000 + 2000);

      setTimeout(function() {
        mocks.done();
        done();
      }, 8000);
    });

    it('after plugin execution phase', function(done) {
      var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client();
      assert.equal(cloudantClient._plugins.length, 1);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      var r = cloudantClient.request(options)
        .on('response', function(resp) {
          assert.equal(resp.statusCode, 200);
          r.abort(); // abort request
        })
        .on('abort', function() {
          mocks.done();
          done();
        });
    });
  });

  describe('using callbacks', function() {
    describe('with no plugins', function() {
      it('performs request and returns response', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":0') > -1);
          mocks.done();
          done();
        });
      });

      it('performs request and returns error', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');
          mocks.done();
          done();
        });
      });
    });

    describe('with single Noop plugin', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":0') > -1);

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 1);

          mocks.done();
          done();
        });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
      });
    });

    describe('with multiple Noop plugins', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient.addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient.addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":0') > -1);

          cloudantClient._plugins.forEach(function(plugin) {
            assert.equal(plugin.onRequestCallCount, 1);
            assert.equal(plugin.onErrorCallCount, 0);
            assert.equal(plugin.onResponseCallCount, 1);
          });

          mocks.done();
          done();
        });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient.addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient.addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          cloudantClient._plugins.forEach(function(plugin) {
            assert.equal(plugin.onRequestCallCount, 1);
            assert.equal(plugin.onErrorCallCount, 1);
            assert.equal(plugin.onResponseCallCount, 0);
          });

          mocks.done();
          done();
        });
      });
    });

    describe('with ComplexPlugin1 ', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .put(DBNAME)
            .times(10)
            .reply(412, {
              error: 'file_exists',
              reason: 'The database could not be created, the file already exists.'
            });
        }

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin1);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'HEAD' // ComplexPlugin1 will set method to 'PUT'
        };
        var startTs = (new Date()).getTime();
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 412);
          assert.ok(data.indexOf('"error":"file_exists"') > -1);
          assert.equal(resp.request.headers.ComplexPlugin1, 'foo');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 10);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (10 + 20 + 40 + 80 + 160 + 320 + 640 + 1280 + 2560));

          mocks.done();
          done();
        });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .put(DBNAME).times(10)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin1);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET' // ComplexPlugin1 will set method to 'PUT'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
      });
    });

    describe('with ComplexPlugin2', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(401, {
            error: 'unauthorized',
            reason: '_reader access is required for this request'
          });

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'POST' // ComplexPlugin2 will set method to 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 401);
          assert.ok(data.indexOf('"error":"unauthorized"') > -1);
          assert.equal(resp.request.headers.ComplexPlugin2, 'bar');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 2);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);

          mocks.done();
          done();
        });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
            .get('/bar')
            .reply(200, {ok: true});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'DELETE' // ComplexPlugin2 will set method to 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"ok":true') > -1);

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
      });
    });

    describe('with ComplexPlugin3', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(500, {
            error: 'internal_server_error',
            reason: 'Internal Server Error'
          })
          .delete('/bar')
          .reply(200, {ok: true});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin3);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"ok":true') > -1);

          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);

          mocks.done();
          done();
        });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin3);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
      });
    });

    describe('with multiple plugins', function() {
      it('performs request and calls all response hooks', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .get(DBNAME).times(3)
            .reply(200, {doc_count: 0});
        }

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient.addPlugins([
          testPlugin.PluginA,
          testPlugin.PluginB,
          testPlugin.PluginC,
          testPlugin.PluginD
        ]);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":0') > -1);

          mocks.done();
          done();
        });
      });

      it('performs request and calls all error hooks', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME).times(3)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient.addPlugins([
          testPlugin.PluginA,
          testPlugin.PluginB,
          testPlugin.PluginC,
          testPlugin.PluginD
        ]);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          mocks.done();
          done();
        });
      });
    });
  });

  describe('using listeners', function() {
    describe('with no plugins', function() {
      it('performs request and returns response', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
          })
          .on('end', function() {
            mocks.done();
            done();
          });
      });

      it('performs request and returns error', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');
            mocks.done();
            done();
          });
      });
    });

    describe('with single Noop plugin', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 1);
            mocks.done();
            done();
          });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');

            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

            mocks.done();
            done();
          });
      });
    });

    describe('with multiple Noop plugins', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient.addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient.addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 1);
            mocks.done();
            done();
          });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient.addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient.addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient.addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');

            cloudantClient._plugins.forEach(function(plugin) {
              assert.equal(plugin.onRequestCallCount, 1);
              assert.equal(plugin.onErrorCallCount, 1);
              assert.equal(plugin.onResponseCallCount, 0);
            });

            mocks.done();
            done();
          });
      });
    });

    describe('with ComplexPlugin1', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .put(DBNAME)
            .times(10)
            .reply(412, {
              error: 'file_exists',
              reason: 'The database could not be created, the file already exists.'
            });
        }

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin1);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'HEAD' // ComplexPlugin1 will set method to 'PUT'
        };
        var startTs = (new Date()).getTime();
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 412);
            assert.equal(resp.request.headers.ComplexPlugin1, 'foo');
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"error":"file_exists"') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 10);

            // validate retry delay
            var now = (new Date()).getTime();
            assert.ok(now - startTs > (10 + 20 + 40 + 80 + 160 + 320 + 640 + 1280 + 2560));

            mocks.done();
            done();
          });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .put(DBNAME).times(10)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin1);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET' // ComplexPlugin1 will set method to 'PUT'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');

            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 10);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

            mocks.done();
            done();
          });
      });
    });

    describe('with ComplexPlugin2', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(401, {
            error: 'unauthorized',
            reason: '_reader access is required for this request'
          });

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'POST' // ComplexPlugin2 will set method to 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 401);
            assert.equal(resp.request.headers.ComplexPlugin2, 'bar');
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 2);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);

            mocks.done();
            done();
          });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
            .get('/bar')
            .reply(200, {ok: true});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'DELETE' // ComplexPlugin2 will set method to 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"ok":true') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);
            mocks.done();
            done();
          });
      });
    });

    describe('with ComplexPlugin3', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(500, {
            error: 'internal_server_error',
            reason: 'Internal Server Error'
          })
          .delete('/bar')
          .reply(200, {ok: true});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin3);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"ok":true') > -1);
          })
          .on('end', function() {
            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);
            mocks.done();
            done();
          });
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 10, plugins: [] });
        cloudantClient.addPlugins(testPlugin.ComplexPlugin3);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');

            assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

            mocks.done();
            done();
          });
      });
    });

    describe('with multiple plugins', function() {
      it('performs request and calls all response hooks', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .get(DBNAME).times(3)
            .reply(200, {doc_count: 0});
        }

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient.addPlugins([
          testPlugin.PluginA,
          testPlugin.PluginB,
          testPlugin.PluginC,
          testPlugin.PluginD
        ]);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
          })
          .on('end', function() {
            mocks.done();
            done();
          });
      });

      it('performs request and calls all error hooks', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME).times(3)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient.addPlugins([
          testPlugin.PluginA,
          testPlugin.PluginB,
          testPlugin.PluginC,
          testPlugin.PluginD
        ]);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.equal(err.code, 'ECONNRESET');
            assert.equal(err.message, 'socket hang up');

            mocks.done();
            done();
          });
      });
    });
  });

  describe('using promises', function() {
    describe('with no other plugins', function() {
      it('performs request and returns response with promise client', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugin: 'promises' });
        assert.equal(cloudantClient._plugins.length, 0);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.equal(data.doc_count, 0);
          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and returns error', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugin: 'promises' });
        assert.equal(cloudantClient._plugins.length, 0);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');
          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with single Noop plugin', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: ['promises', testPlugin.NoopPlugin] });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.equal(data.doc_count, 0);

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 1);

          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: ['promises', testPlugin.NoopPlugin] });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with multiple Noop plugins', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
            .get(DBNAME)
            .reply(200, {doc_count: 0});

        var cloudantClient = new Client({ plugins: [
          'promises',
          testPlugin.NoopPlugin1, // plugin 1
          testPlugin.NoopPlugin2, // plugin 2
          testPlugin.NoopPlugin3  // plugin 3
        ]});
        assert.equal(cloudantClient._plugins.length, 3);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.equal(data.doc_count, 0);

          cloudantClient._plugins.forEach(function(plugin) {
            assert.equal(plugin.onRequestCallCount, 1);
            assert.equal(plugin.onErrorCallCount, 0);
            assert.equal(plugin.onResponseCallCount, 1);
          });

          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({plugins: [
          'promises',
          testPlugin.NoopPlugin1, // plugin 1
          testPlugin.NoopPlugin2, // plugin 2
          testPlugin.NoopPlugin3  // plugin 3
        ]});
        assert.equal(cloudantClient._plugins.length, 3);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          cloudantClient._plugins.forEach(function(plugin) {
            assert.equal(plugin.onRequestCallCount, 1);
            assert.equal(plugin.onErrorCallCount, 1);
            assert.equal(plugin.onResponseCallCount, 0);
          });

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with ComplexPlugin1 ', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .put(DBNAME)
            .times(10)
            .reply(412, {
              error: 'file_exists',
              reason: 'The database could not be created, the file already exists.'
            });
        }

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin1]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'HEAD' // ComplexPlugin1 will set method to 'PUT'
        };
        var startTs = (new Date()).getTime();
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.statusCode, 412);
          assert.equal(err.error, 'file_exists');
          assert.equal(err.reason, 'The database could not be created, the file already exists.');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 10);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (10 + 20 + 40 + 80 + 160 + 320 + 640 + 1280 + 2560));

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .put(DBNAME).times(10)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin1]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET' // ComplexPlugin1 will set method to 'PUT'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 10);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with ComplexPlugin2', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(401, {
            error: 'unauthorized',
            reason: '_reader access is required for this request'
          });

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin2]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'POST' // ComplexPlugin2 will set method to 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.statusCode, 401);
          assert.equal(err.error, 'unauthorized');
          assert.equal(err.reason, '_reader access is required for this request');

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 2);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
            .get('/bar')
            .reply(200, {ok: true});

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin2]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'DELETE' // ComplexPlugin2 will set method to 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.ok(data.ok);

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with ComplexPlugin3', function() {
      it('performs request and calls request and response hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .times(2)
          .reply(500, {
            error: 'internal_server_error',
            reason: 'Internal Server Error'
          })
          .delete('/bar')
          .reply(200, {ok: true});

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin3]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.ok(data.ok);

          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 2);

          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
            .get(DBNAME)
            .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({
          maxAttempt: 10,
          plugins: ['promises', testPlugin.ComplexPlugin3]
        });
        assert.equal(cloudantClient._plugins.length, 1);
        assert.ok(cloudantClient._cfg.usePromises);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });

    describe('with multiple plugins', function() {
      it('performs request and calls all response hooks', function(done) {
        var mocks = nock(SERVER);
        if (!process.env.NOCK_OFF) {
          mocks
            .get(DBNAME).times(3)
            .reply(200, {doc_count: 0});
        }

        var cloudantClient = new Client({
          maxAttempt: 3,
          plugins: [
            'promises',
            testPlugin.PluginA,
            testPlugin.PluginB,
            testPlugin.PluginC,
            testPlugin.PluginD
          ]
        });

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.equal(data.doc_count, 0);
          mocks.done();
          done();
        }).catch(function(err) {
          assert.fail(`Unexpected reject: ${err}`);
        });
        assert.ok(p instanceof Promise);
      });

      it('performs request and calls all error hooks', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME).times(3)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ maxAttempt: 3,
          plugins: [
            'promises',
            testPlugin.PluginA,
            testPlugin.PluginB,
            testPlugin.PluginC,
            testPlugin.PluginD
          ]
        });

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var p = cloudantClient.request(options).then(function(data) {
          assert.fail(`Unexpected resolve: ${data}`);
        }).catch(function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          mocks.done();
          done();
        });
        assert.ok(p instanceof Promise);
      });
    });
  });
});
