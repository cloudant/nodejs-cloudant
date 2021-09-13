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
const Client = require('../../lib/client.js');
const Cloudant = require('../../cloudant.js');
const nock = require('../nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon!@#"£$%^&*()';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const SERVER_NO_PROTOCOL = SERVER.replace(/^https?:\/\//, '');
const SERVER_WITH_CREDS = `https://${ME}:${encodeURIComponent(PASSWORD)}@${SERVER_NO_PROTOCOL}`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;
const COOKIEAUTH_PLUGIN = [ { cookieauth: { autoRenew: false } } ];

// mock cookies

const MOCK_COOKIE = 'AuthSession=Y2xbZWr0bQlpcc19ZQN8OeU4OWFCNYcZOxgdhy-QRDp4i6JQrfkForX5OU5P';
const MOCK_SET_COOKIE_HEADER = { 'set-cookie': `${MOCK_COOKIE}; Version=1; Max-Age=1; Path=/; HttpOnly` };

const MOCK_COOKIE_2 = 'AuthSession=Q2fbIWc0kQspdc39OQL89eS4PWECcYEZDxgdgy-0RCp2i0dcrDkfoWX7OI5A';
const MOCK_SET_COOKIE_HEADER_2 = { 'set-cookie': `${MOCK_COOKIE_2}; Version=1; Max-Age=1; Path=/; HttpOnly` };

describe('#db CookieAuth Plugin', function() {
  before(function(done) {
    var mocks = nock(SERVER)
      .put(DBNAME)
      .reply(201, {ok: true});

    var cloudantClient = new Client({ plugins: [] });

    var req = {
      url: SERVER_WITH_CREDS + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'PUT'
    };
    cloudantClient.request(req, function(err, resp) {
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

    var cloudantClient = new Client({ plugins: [] });

    var req = {
      url: SERVER_WITH_CREDS + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'DELETE'
    };
    cloudantClient.request(req, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
      mocks.done();
      done();
    });
  });

  describe('with callback only', function() {
    it('performs request and returns 200 response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('performs multiple requests that return 200 responses with only a single session request', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER);
      if (!process.env.NOCK_OFF) {
        mocks
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .times(2)
          .reply(200, {doc_count: 0});
      }

      var end1 = false;
      var end2 = false;

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        end1 = true;
        if (end2) {
          mocks.done();
          done();
        }
      });

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        end2 = true;
        if (end1) {
          mocks.done();
          done();
        }
      });
    });

    it('disables cookie authentication for missing credentials when using default cookieauth plugin', function(done) {
      var mocks = nock(SERVER)
        .get(DBNAME)
        .reply(401, { error: 'unauthorized' });

      // 'cookieauth' plugin is added by default with `errorOnNoCreds: false`
      var cloudantClient = new Client({ creds: { outUrl: SERVER } });
      var req = { url: SERVER + DBNAME, method: 'GET' };

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 401);
        assert.ok(data.indexOf('unauthorized') > -1);

        // assert 'cookieauth' plugin has been disabled
        assert.ok(cloudantClient.getPlugin('cookieauth').disabled);

        mocks.done();
        done();
      });
    });

    it('throws error for missing credentials when cookieauth plugin is specified', function() {
      assert.throws(
        () => {
          /* eslint-disable no-new */
          new Client({ creds: { outUrl: SERVER }, plugins: COOKIEAUTH_PLUGIN });
        },
        /Credentials are required for cookie authentication/,
        'did not throw with expected message'
      );
    });

    it('performs request and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        assert.equal(resp.statusCode, 500);
        assert.ok(data.indexOf('"error":"internal_server_error"') > -1);
        mocks.done();
        done();
      });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');
        mocks.done();
        done();
      });
    });

    it('retries session post on 500 and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('retries session post on error and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('returns 401 error on authentication retry failure', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .times(3)
        .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.message, 'Failed to get cookie. Status code: 401');
        mocks.done();
        done();
      });
    });

    it('returns 200 response on authentication retry success', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .times(2)
        .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('renews authentication token on 401 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER_2)
        .get(DBNAME)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: COOKIEAUTH_PLUGIN });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE_2);
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('pre-emptive renewal outlasts original session', function() {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get(DBNAME)
        .matchHeader('cookie', MOCK_COOKIE)
        .reply(200, {doc_count: 0})
        // pre-emptive renewals every 500 ms
        .post('/_session', {name: ME, password: PASSWORD})
        .times(2)
        .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER_2)
        .get(DBNAME)
        .matchHeader('cookie', MOCK_COOKIE_2)
        .reply(200, {doc_count: 0});

      var cloudantClient = new Cloudant({
        url: SERVER,
        username: ME,
        password: PASSWORD,
        maxAttempt: 1
        // Note using default cookieauth plugin
      });
      return cloudantClient.db.get(DBNAME.substring(1)) /* Remove leading slash */
        .then(() => {
          // Wait long enough for a pre-emptive renewal and orignal session to lapse
          return new Promise(resolve => setTimeout(resolve, 1000));
        })
        .then(() => {
          return cloudantClient.db.get(DBNAME.substring(1));
        })
        .finally(() => {
          mocks.done();
        });
    });
  });
});
