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

/* global describe it before after */
'use strict';

const assert = require('assert');
const Client = require('../lib/client.js');
const Cloudant = require('../cloudant.js');
const nock = require('./nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const DBNAME = `nodejs-cloudant-${uuidv4()}`;

const COOKIEAUTH_PLUGIN = [ { cookieauth: { autoRenew: false } } ];

describe('Cloudant #db', function() {
  before(function(done) {
    var mocks = nock(SERVER)
      .put(`/${DBNAME}`)
      .reply(201, { ok: true });

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: `${SERVER}/${DBNAME}`,
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

  describe('set_security', function() {
    it('add _reader nobody role', function(done) {
      var security = { cloudant: { nobody: [ '_reader' ] } };

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/_api/v2/db/${DBNAME}/_security`, security)
        .reply(200, { ok: true })
        .get(`/_api/v2/db/${DBNAME}/_security`)
        .reply(200, security);

      var cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: COOKIEAUTH_PLUGIN });
      var db = cloudant.db.use(DBNAME);

      db.set_security(security, function(err, result) {
        assert.equal(err, null);
        assert.ok(result.ok);

        db.get_security(function(err, result) {
          assert.equal(err, null);
          assert.deepEqual(result, security);
          mocks.done();
          done();
        });
      });
    });

    it('add _writer nobody role (with missing cloudant key)', function(done) {
      var role = { nobody: [ '_writer' ] }; // no cloudant key
      var security = { cloudant: role };

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/_api/v2/db/${DBNAME}/_security`, security)
        .reply(200, { ok: true })
        .get(`/_api/v2/db/${DBNAME}/_security`)
        .reply(200, security);

      var cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: COOKIEAUTH_PLUGIN });
      var db = cloudant.db.use(DBNAME);

      db.set_security(role, function(err, result) {
        assert.equal(err, null);
        assert.ok(result.ok);

        db.get_security(function(err, result) {
          assert.equal(err, null);
          assert.deepEqual(result, security);
          mocks.done();
          done();
        });
      });
    });

    it('set couchdb_auth_only mode', function(done) {
      var security = {
        couchdb_auth_only: true,
        members: {
          names: ['member'],
          roles: []
        },
        admins: {
          names: ['admin'],
          roles: []
        }
      };

      var mocks = nock(SERVER)
        .post('/_session')
        .reply(200, { ok: true })
        .put(`/${DBNAME}/_security`, security)
        .reply(200, { ok: true })
        .get(`/_api/v2/db/${DBNAME}/_security`)
        .reply(200, security);

      var cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: COOKIEAUTH_PLUGIN });
      var db = cloudant.db.use(DBNAME);

      db.set_security(security, function(err, result) {
        assert.equal(err, null);
        assert.ok(result.ok);

        db.get_security(function(err, result) {
          assert.equal(err, null);
          assert.deepEqual(result, security);
          mocks.done();
          done();
        });
      });
    });
  });
});
