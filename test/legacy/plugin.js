// Copyright © 2015, 2019 IBM Corp. All rights reserved.
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

// Cloudant client API tests
require('dotenv').config({silent: true});

var fs = require('fs');
var should = require('should');
var assert = require('assert');
var uuid = require('uuid/v4');

var nock = require('../nock.js');
var Cloudant = require('../../cloudant.js');
var request = require('request');
var PassThroughDuplex = require('../../lib/passthroughduplex.js');

// These globals may potentially be parameterized.
var ME = process.env.cloudant_username || 'nodejs';
var PASSWORD = process.env.cloudant_password || 'sjedon';
var SERVER = process.env.SERVER_URL || 'https://' + ME + '.cloudant.com';
var SERVER_NO_PROTOCOL = SERVER.replace(/^https?:\/\//, '');
var SERVER_WITH_CREDS = `https://${ME}:${PASSWORD}@${SERVER_NO_PROTOCOL}`;

const COOKIEAUTH_PLUGIN = [ { cookieauth: { autoRenew: false } } ];

var dbName;
var mydb = null;
var cc = null;
var ddoc = null;
var viewname = null;

// hooks

var onBefore = function(done) {
  const unique = uuid();
  dbName = 'nodejs_cloudant_test_' + unique;
  var mocks = nock(SERVER)
      .put('/' + dbName).reply(200, { 'ok': true })
      .put('/' + dbName + '/mydoc').reply(200, { id: 'mydoc', rev: '1-1' });

  cc = Cloudant({url: SERVER, username: ME, password: PASSWORD, plugins: 'retry'});
  cc.db.create(dbName, function(er, d) {
    should(er).equal(null);
    d.should.be.an.Object;
    d.should.have.a.property('ok');
    d.ok.should.be.equal(true);
    mydb = cc.db.use(dbName);

    // add a doc
    mydb.insert({ foo: true }, 'mydoc', function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property('id');
      d.should.have.a.property('rev');
      mocks.done();
      done();
    });
  });
};

var onAfter = function(done) {
  var mocks = nock(SERVER)
      .delete('/' + dbName).reply(200, { 'ok': true });

  cc.db.destroy(dbName, function(er, d) {
    should(er).equal(null);
    d.should.be.an.Object;
    d.should.have.a.property('ok');
    d.ok.should.be.equal(true);
    mydb = null;
    cc = null;

    mocks.done();
    done();
  });
};

describe('retry-on-429 plugin #db', function() {
  before(onBefore);
  after(onAfter);

  it('behave normally too', function(done) {
    var mocks = nock(SERVER)
    if (typeof(process.env.NOCK_OFF) === 'undefined') {
      mocks.persist().get('/' + dbName).reply(200, {});
    }
    var cloudant = Cloudant({plugins: 'retry', url: SERVER, username: ME, password: PASSWORD});
    cloudant.cc._addPlugins('retry'); // retry socket hang up errors
    var db = cloudant.db.use(dbName);
    this.timeout(10000);
    db.info(function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      done();
    });
  });

  it('allow no callback', function(done) {
    var mocks = nock(SERVER).get('/' + dbName).reply(200, {});
    var cloudant = Cloudant({plugins: 'retry', url: SERVER, username: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    this.timeout(10000);
    db.info();
    setTimeout(done, 1000);
  });

  it('should return a stream', function(done) {
    var mocks = nock(SERVER)
        .get('/_all_dbs').reply(200, ['_replicator','_users']);
    var cloudant = Cloudant({plugins: 'retry', url: SERVER, username: ME, password: PASSWORD});
    var dbs = cloudant.db.listAsStream()
    .once('end', function() {
      done()
    });
    assert.equal(dbs instanceof PassThroughDuplex, true);
  });

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({plugins: 'retry', url: SERVER, username: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.info().then(function() {
      done();
    });
    assert.equal(p instanceof Promise, true);
  });
});

describe('promises #db', function() {
  before(onBefore);
  after(onAfter);

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({url: SERVER, username: ME, password: PASSWORD, plugins: []});
    var db = cloudant.db.use(dbName);
    var p = db.info().then(function(data) {
      data.should.be.an.Object;
      done();
    });
    assert.equal(p instanceof Promise, true);
  });

  it('should return an error status code', function(done) {
    var mocks = nock(SERVER)
        .get('/somedbthatdoesntexist').reply(404, { ok: false });
    var cloudant = Cloudant({url: SERVER, username: ME, password: PASSWORD, plugins: []});
    var db = cloudant.db.use('somedbthatdoesntexist');
    var p = db.info().then(function(data) {
      assert(false);
    }).catch(function(e) {
      e.should.be.an.Object;
      e.should.have.property.statusCode;
      e.statusCode.should.be.a.Number;
      e.statusCode.should.equal(404);
      done();
    });
    assert.equal(p instanceof Promise, true);
  });
});

describe('custom plugin #db', function() {
  before(onBefore);
  after(onAfter);

  var defaultPlugin = function(opts, callback) {
    return request(opts, callback);
  };

  it('should allow custom plugins', function(done) {
    var mocks = nock(SERVER)
      .get('/')
      .reply(200, { couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488' });

    var cloudant = Cloudant({ plugins: defaultPlugin, url: SERVER, username: ME, password: PASSWORD });
    cloudant.ping(function(err, data) {
      assert.equal(err, null);
      assert.equal(data.couchdb, 'Welcome');
      mocks.done();
      done();
    });
  });

  var defaultPlugin2 = function(opts, callback) {
    return request(opts, callback);
  };

  it('errors if multiple custom plugins are specified', function() {
    assert.throws(
      () => {
        Cloudant({ plugins: [ defaultPlugin, defaultPlugin2 ], account: ME, password: PASSWORD });
      },
      /Using multiple legacy plugins is not permitted/,
      'did not throw with expected message'
    );
  });

  it('should allow custom plugins using asynchronous instantiation', function(done) {
    var mocks = nock(SERVER)
      .post('/_session', { name: ME, password: PASSWORD })
      .reply(200, { ok: true })
      .get('/')
      .reply(200, { couchdb: 'Welcome' });

    Cloudant({
      creds: { outUrl: SERVER_WITH_CREDS },
      plugins: defaultPlugin,
      url: SERVER,
      username: ME,
      password: PASSWORD
    }, function(err, nano, pong) {
      assert.equal(err, null);
      assert.notEqual(nano, null);
      assert.equal(pong.couchdb, 'Welcome');
      mocks.done();
      done();
    });
  });
});

describe('cookieauth plugin #db', function() {
  before(onBefore);
  after(onAfter);

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
        .post('/_session').reply(200, { ok: true })
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({plugins: COOKIEAUTH_PLUGIN, url: SERVER, username: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.info().then(function(data) {
      data.should.be.an.Object;
      // check that we use all the nocked API calls
      mocks.done();
      done();
    });
    assert.equal(p instanceof Promise, true);
  });

  it('should authenticate before attempting API call', function(done) {
    var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD}).reply(200, { ok: true, info: {}, userCtx: { name: ME, roles: ['_admin'] } })
        .get('/' + dbName + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true });
    var cloudant = Cloudant({plugins: COOKIEAUTH_PLUGIN, url: SERVER, username: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      data.should.have.property._id;
      data.should.have.property._rev;
      data.should.have.property.ok;

      // check that we use all the nocked API calls
      mocks.done();
      done();
    });
  });

  it('should only authenticate once', function(done) {
    var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD}).reply(200, { ok: true, info: {}, userCtx: { name: ME, roles: ['_admin'] } }, { 'Set-Cookie': 'AuthSession=xyz; Version=1; Path=/; HttpOnly' })
        .get('/' + dbName + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true })
        .get('/' + dbName + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true });
    var cloudant = Cloudant({plugins: COOKIEAUTH_PLUGIN, url: SERVER, username: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      data.should.have.property._id;
      data.should.have.property._rev;
      data.should.have.property.ok;

      db.get('mydoc', function(err, data) {
        assert.equal(err, null);
        data.should.be.an.Object;
        data.should.have.property._id;
        data.should.have.property._rev;
        data.should.have.property.ok;

        // check that we use all the nocked API calls
        mocks.done();
        done();
      });
    });
  });
});
