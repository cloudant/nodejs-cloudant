// Copyright © 2018, 2019 IBM Corp. All rights reserved.
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
const Client = require('../lib/client.js');
const Cloudant = require('../cloudant.js');
const nock = require('./nock.js');
const u = require('url');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const DBNAME = `nodejs-cloudant-${uuidv4()}`;

describe('#db README Examples', function() {
  describe('Getting Started', function() {
    afterEach(function(done) {
      var mocks = nock(SERVER)
        .delete(`/${DBNAME}`)
        .reply(200, { ok: true });

      var cloudantClient = new Client({ plugins: 'retry' });

      var options = {
        url: `${SERVER}/${DBNAME}`,
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

    it('Initialization', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/${DBNAME}`)
        .reply(201, { ok: true });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.db.create(DBNAME).then(() => {
        mocks.done();
        done();
      }).catch(done);
    });

    it('Simple Example: Using Async/Await', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/${DBNAME}`)
        .reply(201, { ok: true })
        .put(`/${DBNAME}/rabbit`, { happy: true })
        .reply(200, { ok: true, _id: 'rabbit' });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });

      async function asyncCall() {
        await cloudant.db.create(DBNAME);
        return cloudant.use(DBNAME).insert({ happy: true }, 'rabbit');
      }

      asyncCall().then((data) => {
        assert.ok(data.ok);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Simple Example: Using Promises', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/${DBNAME}`)
        .reply(201, { ok: true })
        .put(`/${DBNAME}/rabbit`, { happy: true })
        .reply(200, { ok: true, _id: 'rabbit' });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });

      cloudant.db.create(DBNAME).then(() => {
        cloudant.use(DBNAME).insert({ happy: true }, 'rabbit').then((data) => {
          assert.ok(data.ok);
          mocks.done();
          done();
        });
      }).catch(done);
    });

    it('Simple Example: Using Callbacks', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/${DBNAME}`)
        .reply(201, { ok: true })
        .put(`/${DBNAME}/rabbit`, { happy: true })
        .reply(200, { ok: true, _id: 'rabbit' });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });

      cloudant.db.create(DBNAME, (err) => {
        assert.ifError(err);
        cloudant.use(DBNAME).insert({ happy: true }, 'rabbit', (err, data) => {
          assert.ifError(err);
          assert.ok(data.ok);
          mocks.done();
          done();
        });
      });
    });
  });

  describe('Initialization', function() {
    it('Using URL without credentials', function(done) {
      var mocks = nock(SERVER)
        .get('/_session')
        .reply(200, { userCtx: { name: null } });

      var cloudant = Cloudant({url: SERVER, plugins: []});
      cloudant.session().then((session) => {
        assert.equal(session.userCtx.name, null);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Using URL with credentials', function(done) {
      var mocks = nock(SERVER)
        .get('/_session')
        .reply(200, { userCtx: { name: ME } });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER, plugins: [] });
      cloudant.session().then((session) => {
        assert.equal(session.userCtx.name, ME);
        let actual = new u.URL(cloudant.config.url);
        assert.equal(actual.username, ME);
        assert.equal(actual.password, PASSWORD);
        assert.equal(actual.origin, SERVER);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Using account credentials', function(done) {
      var mocks = nock(SERVER)
        .get('/_session')
        .reply(200, { userCtx: { name: ME } });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER, plugins: [] });
      cloudant.session().then((session) => {
        assert.equal(session.userCtx.name, ME);
        let actual = new u.URL(cloudant.config.url);
        assert.equal(actual.username, ME);
        assert.equal(actual.password, PASSWORD);
        assert.equal(actual.origin, SERVER);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Using other account credentials', function() {
      if (process.env.NOCK_OFF) {
        this.skip();
      }
      var cloudant = Cloudant({
        account: ME,
        username: 'otherUsername',
        password: 'otherPassword',
        plugins: []
      });
      assert.equal(cloudant.config.url, `https://otherUsername:otherPassword@${ME}.cloudant.com`);
    });

    it('Connecting to Cloudant Local', function() {
      if (process.env.NOCK_OFF) {
        this.skip();
      }
      var cloudant = Cloudant({
        url: 'https://company.cloudant.local',
        username: 'somebody',
        password: 'secret',
        plugins: []
      });
      assert.equal(cloudant.config.url, `https://somebody:secret@company.cloudant.local`);
    });

    it('With callback', function(done) {
      var mocks = nock(SERVER)
        .post('/_session', { name: ME, password: PASSWORD })
        .reply(200, { ok: true })
        .get('/')
        .reply(200, { couchdb: 'Welcome' })
        .get('/_all_dbs')
        .reply(200, [ 'animaldb' ]);

      let cookieauth = [ { cookieauth: { autoRenew: false } } ];
      Cloudant({ username: ME, password: PASSWORD, url: SERVER, plugins: cookieauth }, function(err, cloudant, pong) {
        assert.ifError(err);
        assert.equal(pong.couchdb, 'Welcome');

        cloudant.db.list().then((body) => {
          assert.ok(body.indexOf('animaldb') > -1);
          mocks.done();
          done();
        }).catch(done);
      });
    });
  });

  describe('Callback Signature', function() {
    it('Error', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .get('/animaldb/non-existent-doc')
        .reply(404, { error: 'not_found', reason: 'missing' });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      var db = cloudant.db.use('animaldb');
      db.get('non-existent-doc', function(err, data) {
        assert.equal(err.name, 'Error');
        assert.equal(err.error, 'not_found');
        assert.equal(err.reason, 'missing');
        assert.equal(data, undefined);
        mocks.done();
        done();
      });
    });

    it('Body', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .get('/animaldb/panda')
        .reply(200, { _id: 'panda', 'max_weight': 115 });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      var db = cloudant.db.use('animaldb');
      db.get('panda', function(err, data) {
        assert.ifError(err);
        assert.equal(data.max_weight, 115);
        mocks.done();
        done();
      });
    });

    it('Headers', function(done) {
      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .get('/animaldb/panda')
        .reply(200, { _id: 'panda' });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      var db = cloudant.db.use('animaldb');
      db.get('panda', function(err, data, headers) {
        assert.ifError(err);
        assert.equal(headers['content-type'], 'application/json');
        mocks.done();
        done();
      });
    });
  });

  describe('Request Plugins', function() {
    it('Plugin Configuration', function() {
      var cloudant = new Cloudant({
        url: `https://${ME}.cloudant.com`,
        maxAttempt: 5,
        plugins: [ { iamauth: { iamApiKey: 'abcxyz' } }, { retry: { retryDelayMultiplier: 4 } } ]
      });
      assert.equal(cloudant.cc._plugins.length, 2);
      assert.equal(cloudant.cc._plugins[0].constructor.name, 'IAMPlugin');
      assert.equal(cloudant.cc._plugins[0]._cfg.iamApiKey, 'abcxyz');
      assert.equal(cloudant.cc._plugins[1].constructor.name, 'RetryPlugin');
      assert.equal(cloudant.cc._plugins[1]._cfg.retryDelayMultiplier, 4);
    });

    it('Cookie Authentication', function() {
      var cloudant = new Cloudant({
        account: ME,
        password: PASSWORD,
        plugins: 'cookieauth'
      });
      assert.equal(cloudant.cc._plugins.length, 1);
      assert.equal(cloudant.cc._plugins[0].constructor.name, 'CookiePlugin');
    });

    it('IAM Authentication', function() {
      var cloudant = new Cloudant({
        url: `https://${ME}.cloudant.com`,
        plugins: { iamauth: { iamApiKey: 'abcxyz' } }
      });
      assert.equal(cloudant.cc._plugins.length, 1);
      assert.equal(cloudant.cc._plugins[0].constructor.name, 'IAMPlugin');
      assert.equal(cloudant.cc._plugins[0]._cfg.iamApiKey, 'abcxyz');
    });

    it('Retry Authentication', function() {
      var cloudant = new Cloudant({
        url: `https://${ME}.cloudant.com`,
        plugins: { retry: { retryErrors: false, retryStatusCodes: [ 429 ] } }
      });
      assert.equal(cloudant.cc._plugins.length, 1);
      assert.equal(cloudant.cc._plugins[0].constructor.name, 'RetryPlugin');
      assert.equal(cloudant.cc._plugins[0]._cfg.retryErrors, false);
      assert.deepEqual(cloudant.cc._plugins[0]._cfg.retryStatusCodes, [ 429 ]);
    });

    it('Using Multiple Plugins', function() {
      var cloudant = new Cloudant({
        account: ME,
        password: PASSWORD,
        plugins: [ 'cookieauth', { retry: { retryDelayMultiplier: 4 } } ]
      });
      assert.equal(cloudant.cc._plugins.length, 2);
      assert.equal(cloudant.cc._plugins[0].constructor.name, 'CookiePlugin');
      assert.equal(cloudant.cc._plugins[1].constructor.name, 'RetryPlugin');
      assert.equal(cloudant.cc._plugins[1]._cfg.retryDelayMultiplier, 4);
    });
  });

  describe('Authorization and Cloudant API Keys', function() {
    it('Generate a Cloudant API key', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .post('/_api/v2/api_keys')
        .reply(200, { key: 'foo', password: 'bar' })
        .put('/_api/v2/db/animaldb/_security', { cloudant: {
          nobody: [],
          nodejs: [ '_reader', '_writer', '_admin', '_replicator' ],
          foo: [ '_reader', '_writer' ]
        }})
        .reply(200, { ok: true })
        .get('/_api/v2/db/animaldb/_security')
        .reply(200, { ok: true });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.generate_api_key(function(err, api) {
        assert.ifError(err);
        assert.equal(api.key, 'foo');
        assert.equal(api.password, 'bar');

        var security = {
          nobody: [],
          nodejs: [ '_reader', '_writer', '_admin', '_replicator' ]
        };
        security[api.key] = [ '_reader', '_writer' ];

        var db = cloudant.db.use('animaldb');
        db.set_security(security, function(err, result) {
          assert.ifError(err);
          assert.ok(result.ok);
          db.get_security(function(err, result) {
            assert.ifError(err);
            assert.ok(result.ok);
            mocks.done();
            done();
          });
        });
      });
    });
  });

  describe('CORS', function() {
    it('Enable from any domain', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put('/_api/v2/user/config/cors', {
          enable_cors: true, allow_credentials: true, origins: ['*']
        })
        .reply(200, { ok: true });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.set_cors({
        enable_cors: true,
        allow_credentials: true,
        origins: [ '*' ]
      }).then((data) => {
        assert.ok(data.ok);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Enable access from a list of specified domains', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var myOrigins = [ 'https://example.com', 'https://www.example.com' ];

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put('/_api/v2/user/config/cors', {
          enable_cors: true, allow_credentials: true, origins: myOrigins
        })
        .reply(200, { ok: true });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.set_cors({
        enable_cors: true,
        allow_credentials: true,
        origins: myOrigins
      }).then((data) => {
        assert.ok(data.ok);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Disable CORS access', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put('/_api/v2/user/config/cors', {
          enable_cors: true, origins: []
        })
        .reply(200, { ok: true });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.set_cors({
        enable_cors: true,
        origins: []
      }).then((data) => {
        assert.ok(data.ok);
        mocks.done();
        done();
      }).catch(done);
    });

    it('Fetch the current CORS configuration', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .get('/_api/v2/user/config/cors')
        .reply(200, {
          enable_cors: true,
          allow_credentials: true,
          origins: [ 'https://example.com' ]
        });

      var cloudant = Cloudant({ username: ME, password: PASSWORD, url: SERVER });
      cloudant.get_cors().then((data) => {
        assert.ok(data.enable_cors);
        assert.ok(data.allow_credentials);
        assert.deepEqual(data.origins, [ 'https://example.com' ]);
        mocks.done();
        done();
      }).catch(done);
    });
  });
});
