// Copyright © 2017, 2019 IBM Corp. All rights reserved.
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
const path = require('path');
const stream = require('stream');
const testPlugin = require('./fixtures/testplugins.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const SERVER_NO_PROTOCOL = SERVER.replace(/^https?:\/\//, '');
const SERVER_WITH_CREDS = `https://${ME}:${PASSWORD}@${SERVER_NO_PROTOCOL}`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;
const DOCID = 'doc1';

describe('CloudantClient', function() {
  before(function(done) {
    var mocks = nock(SERVER)
      .put(DBNAME) // create database
      .reply(201, {ok: true})
      .post(DBNAME) // create document
      .reply(201, {ok: true, id: DOCID, rev: '1-xxxxxxxx'});

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'PUT'
    };
    cloudantClient.request(options, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 201);

      // create a document
      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `{"_id":"${DOCID}","foo":"bar"}`
      };
      cloudantClient.request(options, function(err, resp) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 201);

        mocks.done();
        done();
      });
    });
  });

  after(function(done) {
    var mocks = nock(SERVER)
      .delete(DBNAME)
      .reply(200, {ok: true});

    var cloudantClient = new Client({ plugins: 'retry' });

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

  describe('plugin support', function() {
    it('get plugin path by name', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.equal(cloudantClient._buildPluginPath('dummy-plugin'), '../plugins/dummy-plugin');
    });

    it('get plugin path by relative path', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.equal(cloudantClient._buildPluginPath('./dummy-plugin'), path.join(process.cwd(), 'dummy-plugin'));
    });

    it('get plugin path by absolute path', function() {
      var cloudantClient = new Client({ plugins: [] });
      assert.equal(cloudantClient._buildPluginPath('/plugins/dummy-plugin'), '/plugins/dummy-plugin');
    });

    it('load plugin from custom path', function() {
      let ownPlugin = 'test/fixtures/testplugin.js';
      var cloudantClient = new Client({
        plugins: [ ownPlugin ]
      });
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('adds cookie authentication plugin if no other plugins are specified', function() {
      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS } });
      assert.equal(cloudantClient._plugins.length, 1);
      assert.equal(cloudantClient._plugins[0].id, 'cookieauth');
    });

    it('allows plugins to be added separately', function() {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
      cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
      cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
      assert.equal(cloudantClient._plugins.length, 3);
    });

    it('allows an array of plugins to be added', function() {
      var cloudantClient = new Client({ plugins: [] });
      var plugins = [testPlugin.NoopPlugin1, testPlugin.NoopPlugin2, testPlugin.NoopPlugin3];
      cloudantClient._addPlugins(plugins);
      assert.equal(cloudantClient._plugins.length, 3);
    });

    it('deduplicates plugins when added separately', function() {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient._addPlugins(testPlugin.NoopPlugin); // plugin 1
      cloudantClient._addPlugins(testPlugin.NoopPlugin); // plugin 2
      cloudantClient._addPlugins(testPlugin.NoopPlugin); // plugin 3
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('deduplicates plugins when added as array', function() {
      var cloudantClient = new Client({ plugins: [] });
      var plugins = [testPlugin.NoopPlugin, testPlugin.NoopPlugin, testPlugin.NoopPlugin];
      cloudantClient._addPlugins(plugins);
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('allows a single plugin to be added via "plugins" options', function() {
      var cloudantClient = new Client({ plugins: ['retry'] });
      assert.equal(cloudantClient._plugins.length, 1);
    });

    it('allows an array of plugins to be added via "plugins" options', function() {
      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS },
        plugins: [
          'retry', // plugin 1
          'cookieauth', // plugin 2
          'default', // ignored
          'base' // ignored
        ]
      });
      assert.equal(cloudantClient._plugins.length, 2);
    });

    it('allows plugin configuration to be specified', function() {
      var cloudantClient = new Client({ plugins: [ { retry: { retryInitialDelayMsecs: 12345 } } ] });
      assert.equal(cloudantClient._plugins.length, 1);
      assert.equal(cloudantClient._plugins[0]._cfg.retryInitialDelayMsecs, 12345);
    });

    it('errors when passed an invalid plugin configuration object - too many keys', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ plugins: [ { cookieauth: {}, retry: { retryInitialDelayMsecs: 12345 } } ] });
        },
        /Invalid plugin configuration/,
        'did not throw with expected message'
      );
    });

    it('errors when passed an invalid plugin configuration object - invalid boolean key type', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ plugins: [ { true: { retryInitialDelayMsecs: 12345 } } ] });
        },
        /Failed to load plugin/,
        'did not throw with expected message'
      );
    });

    it('errors when passed an invalid plugin configuration object - invalid number key type', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ plugins: [ { 1: { retryInitialDelayMsecs: 12345 } } ] });
        },
        /Failed to load plugin/,
        'did not throw with expected message'
      );
    });

    it('errors when passed an invalid plugin configuration object - invalid array value type', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ plugins: [ { retry: [ { retryInitialDelayMsecs: 12345 } ] } ] });
        },
        /Invalid plugin configuration/,
        'did not throw with expected message'
      );
    });

    it('errors when passed an invalid plugin configuration object - invalid number value type', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ plugins: [ { retry: 12345 } ] });
        },
        /Invalid plugin configuration/,
        'did not throw with expected message'
      );
    });
  });

  describe('Error Handling', function() {
    it('Propagate request error: Invalid protocol.', function(done) {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.request('abc://localhost:5984', function(err) {
        assert.equal(err.message, 'Invalid protocol: abc:');
        done();
      });
    });

    it('Propagate request error: Base URL must be type string.', function(done) {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.request({ baseUrl: 123, url: '/_all_dbs' }, function(err) {
        assert.equal(err.message, 'options.baseUrl must be a string');
        done();
      });
    });

    it('Propagate request error: `unix://` URL scheme is no longer supported.', function(done) {
      var cloudantClient = new Client({ plugins: [] });
      cloudantClient.request('unix://abc', function(err) {
        assert.equal(
          err.message,
          '`unix://` URL scheme is no longer supported. Please use the format `http://unix:SOCKET:PATH`'
        );
        done();
      });
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
        .reply(200, {doc_count: 1});

      var cloudantClient = new Client({
        maxAttempt: 5,
        plugins: testPlugin.AlwaysRetry
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

    it('after plugin execution phase #db', function(done) {
      var mocks = nock(SERVER)
        .get(DBNAME)
        .reply(200, {doc_count: 1});

      var cloudantClient = new Client({ plugins: [] });
      assert.equal(cloudantClient._plugins.length, 0);

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

  describe('disables a plugin', function() {
    it('skips all plugin hooks on good response', function(done) {
      var mocks = nock(SERVER)
        .get(DBNAME)
        .reply(200, {doc_count: 1});

      var cloudantClient = new Client({ plugins: [] });
      cloudantClient._addPlugins(testPlugin.NoopPlugin);
      assert.equal(cloudantClient._plugins.length, 1);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      // disable the plugin
      cloudantClient.getPlugin('noop').disabled = true;

      cloudantClient.request(options, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":1') > -1);

        // assert hooks are _not_ executed
        assert.equal(cloudantClient._plugins[0].onRequestCallCount, 0);
        assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
        assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

        mocks.done();
        done();
      });
    });

    it('skips all plugin hooks on error response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .get(DBNAME)
        .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ plugins: [] });
      cloudantClient._addPlugins(testPlugin.NoopPlugin);
      assert.equal(cloudantClient._plugins.length, 1);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      // disable the plugin
      cloudantClient.getPlugin('noop').disabled = true;

      cloudantClient.request(options, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');

        // assert hooks are _not_ executed
        assert.equal(cloudantClient._plugins[0].onRequestCallCount, 0);
        assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
        assert.equal(cloudantClient._plugins[0].onResponseCallCount, 0);

        mocks.done();
        done();
      });
    });
  });

  describe('#db using callbacks', function() {
    describe('with no plugins', function() {
      it('performs request and returns response', function(done) {
        var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 1});

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
          assert.ok(data.indexOf('"doc_count":1') > -1);
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

      it('performs request with piped payload and returns response', function(done) {
        var mocks = nock(SERVER)
          .post(DBNAME + '/_all_docs', function(body) {
            assert.deepEqual(body, { keys: [ 'doc1' ] });
            return true;
          })
          .reply(200, { rows: [{ key: 'doc1', value: { rev: '1-xxxxxxxx' } }] });

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var readable = new stream.PassThrough();
        readable.end('{"keys":["doc1"]}'); // request payload

        var options = {
          url: SERVER + DBNAME + '/_all_docs',
          auth: { username: ME, password: PASSWORD },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };

        readable.pipe(cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"key":"doc1","value":{"rev":"1') > -1);
          mocks.done();
          done();
        }));
      });
    });

    describe('with single Noop plugin', function() {
      it('performs request and calls request and response hooks only', function(done) {
        var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 1});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":1') > -1);

          assert.equal(cloudantClient._plugins[0].onRequestCallCount, 1);
          assert.equal(cloudantClient._plugins[0].onErrorCallCount, 0);
          assert.equal(cloudantClient._plugins[0].onResponseCallCount, 1);

          mocks.done();
          done();
        });
      });

      it('performs request with piped payload and returns response', function(done) {
        var mocks = nock(SERVER)
          .post(DBNAME + '/_all_docs', function(body) {
            assert.deepEqual(body, { keys: [ 'doc1' ] });
            return true;
          })
          .reply(200, { rows: [{ key: 'doc1', value: { rev: '1-xxxxxxxx' } }] });

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin);
        assert.equal(cloudantClient._plugins.length, 1);

        var readable = new stream.PassThrough();
        readable.end('{"keys":["doc1"]}'); // request payload

        var options = {
          url: SERVER + DBNAME + '/_all_docs',
          auth: { username: ME, password: PASSWORD },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };

        readable.pipe(cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"key":"doc1","value":{"rev":"1') > -1);
          mocks.done();
          done();
        }));
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin);

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
          .reply(200, {doc_count: 1});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":1') > -1);

          cloudantClient._plugins.forEach(function(plugin) {
            assert.equal(plugin.onRequestCallCount, 1);
            assert.equal(plugin.onErrorCallCount, 0);
            assert.equal(plugin.onResponseCallCount, 1);
          });

          mocks.done();
          done();
        });
      });

      it('performs request with piped payload and returns response', function(done) {
        var mocks = nock(SERVER)
          .post(DBNAME + '/_all_docs', function(body) {
            assert.deepEqual(body, { keys: [ 'doc1' ] });
            return true;
          })
          .reply(200, { rows: [{ key: 'doc1', value: { rev: '1-xxxxxxxx' } }] });

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var readable = new stream.PassThrough();
        readable.end('{"keys":["doc1"]}'); // request payload

        var options = {
          url: SERVER + DBNAME + '/_all_docs',
          auth: { username: ME, password: PASSWORD },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };

        readable.pipe(cloudantClient.request(options, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"key":"doc1","value":{"rev":"1') > -1);
          mocks.done();
          done();
        }));
      });

      it('performs request and calls request and error hooks only', function(done) {
        if (process.env.NOCK_OFF) {
          this.skip();
        }

        var mocks = nock(SERVER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin2);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin2);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin3);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin3);
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
            .reply(200, {doc_count: 1});
        }

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient._addPlugins([
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
          assert.ok(data.indexOf('"doc_count":1') > -1);

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
        cloudantClient._addPlugins([
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

  describe('#db using listeners', function() {
    describe('with no plugins', function() {
      it('performs request and returns response', function(done) {
        var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 1});

        var cloudantClient = new Client({ plugins: [] });
        assert.equal(cloudantClient._plugins.length, 0);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };

        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"doc_count":1') > -1);
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
          .reply(200, {doc_count: 1});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"doc_count":1') > -1);
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
        cloudantClient._addPlugins(testPlugin.NoopPlugin);

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
          .reply(200, {doc_count: 1});

        var cloudantClient = new Client({ plugins: [] });
        cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
        assert.equal(cloudantClient._plugins.length, 3);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"doc_count":1') > -1);
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
        cloudantClient._addPlugins(testPlugin.NoopPlugin1); // plugin 1
        cloudantClient._addPlugins(testPlugin.NoopPlugin2); // plugin 2
        cloudantClient._addPlugins(testPlugin.NoopPlugin3); // plugin 3
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin1);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'HEAD' // ComplexPlugin1 will set method to 'PUT'
        };
        var responseData = '';
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
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"error":"file_exists"') > -1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'POST' // ComplexPlugin2 will set method to 'GET'
        };
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 401);
            assert.equal(resp.request.headers.ComplexPlugin2, 'bar');
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"error":"unauthorized"') > -1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin2);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'DELETE' // ComplexPlugin2 will set method to 'GET'
        };
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"ok":true') > -1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin3);
        assert.equal(cloudantClient._plugins.length, 1);

        var options = {
          url: SERVER + DBNAME,
          auth: { username: ME, password: PASSWORD },
          method: 'GET'
        };
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"ok":true') > -1);
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
        cloudantClient._addPlugins(testPlugin.ComplexPlugin3);
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
            .reply(200, {doc_count: 1});
        }

        var cloudantClient = new Client({ maxAttempt: 3, plugins: [] });
        cloudantClient._addPlugins([
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
        var responseData = '';
        cloudantClient.request(options)
          .on('error', function(err) {
            assert.fail(`Unexpected error: ${err}`);
          })
          .on('response', function(resp) {
            assert.equal(resp.statusCode, 200);
          })
          .on('data', function(data) {
            responseData += data;
          })
          .on('end', function() {
            assert.ok(responseData.toString('utf8').indexOf('"doc_count":1') > -1);
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
        cloudantClient._addPlugins([
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
});
