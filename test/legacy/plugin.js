// Copyright © 2015, 2018 IBM Corp. All rights reserved.
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
var SERVER = 'https://' + ME + '.cloudant.com';
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

  cc = Cloudant({account: ME, password: PASSWORD, plugins: 'retry'});
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

describe('retry-on-429 plugin', function() {
  before(onBefore);
  after(onAfter);

  it('behave normally too', function(done) {
    var mocks = nock(SERVER)
    if (typeof(process.env.NOCK_OFF) === 'undefined') {
      mocks.persist().get('/' + dbName).reply(200, {});
    }
    var cloudant = Cloudant({plugins: 'retry', account: ME, password: PASSWORD});
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
    var cloudant = Cloudant({plugins: 'retry', account: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    this.timeout(10000);
    db.info();
    setTimeout(done, 1000);
  });

  it('should return a stream', function(done) {
    var mocks = nock(SERVER)
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({plugins: 'retry', account: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.info(function() {
      done();
    });
    assert.equal(p instanceof PassThroughDuplex, true);
  });
});

describe('promise plugin', function() {
  before(onBefore);
  after(onAfter);

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({plugins: 'promises', account: ME, password: PASSWORD});
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
    var cloudant = Cloudant({plugins: 'promises', account: ME, password: PASSWORD});
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

describe('cookieauth plugin', function() {
  before(onBefore);
  after(onAfter);

  it('should return a stream', function(done) {
    var mocks = nock(SERVER)
        .post('/_session').reply(200, { ok: true })
        .get('/' + dbName).reply(200, { ok: true });
    var cloudant = Cloudant({plugins: 'cookieauth', account: ME, password: PASSWORD});
    var db = cloudant.db.use(dbName);
    var p = db.info(function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      // check that we use all the nocked API calls
      mocks.done();
      done();
    });
    assert.equal(p instanceof PassThroughDuplex, true);
  });

  it('should authenticate before attempting API call', function(done) {
    var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD}).reply(200, { ok: true, info: {}, userCtx: { name: ME, roles: ['_admin'] } })
        .get('/' + dbName + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true });
    var cloudant = Cloudant({plugins: 'cookieauth', account: ME, password: PASSWORD});
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

  it('should fail with incorrect authentication', function(done) {
    var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: 'wrongpassword'})
        .reply(401, {error: 'unauthorized', reason: 'Name or password is incorrect.'})
        .get('/' + dbName + '/mydoc')
        .reply(401, {error: 'unauthorized', reason: 'Name or password is incorrect.'});
    var cloudant = Cloudant({plugins: 'cookieauth', account: ME, password: 'wrongpassword'});
    var db = cloudant.db.use(dbName);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(data, null);
      err.should.be.an.Object;
      err.should.have.property.error;
      err.should.have.property.reason;

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
    var cloudant = Cloudant({plugins: 'cookieauth', account: ME, password: PASSWORD});
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

  it('should not authenticate without credentials', function(done) {
    var mocks = nock(SERVER)
        .get('/' + dbName + '/mydoc').reply(401, { error: 'unauthorized', reason: '_reader access is required for this request' });
    var cloudant = Cloudant({plugins: 'cookieauth', url: SERVER});
    var db = cloudant.db.use(dbName);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(data, null);
      err.should.be.an.Object;
      err.should.have.property.error;
      err.should.have.property.reason;

      // check that we use all the nocked API calls
      mocks.done();
      done();
    });
  });

  it('should work with asynchronous instantiation', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }
    var mocks = nock(SERVER)
        .post('/_session', {name: ME, password: PASSWORD})
        .reply(401, {error: 'unauthorized', reason: 'Name or password is incorrect.'})
        .get('/')
        .reply(200, {couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488'});
    var cloudant = Cloudant({plugins: 'cookieauth', account: ME, password: PASSWORD}, function(err, cloudant, data) {
      cloudant.should.be.an.Object;
      data.should.be.an.Object.have.a.property('couchdb');
      mocks.done();
      done();
    });
  });

  it('should work with asynchronous instantiation with no credentials', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }
    var mocks = nock(SERVER)
      .get('/')
      .reply(200, { couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488' });
    var cloudant = Cloudant({plugins: 'cookieauth', url: SERVER}, function(err, cloudant, data) {
      cloudant.should.be.an.Object;
      data.should.be.an.Object.have.a.property('couchdb');
      mocks.done();
      done();
    });
  });
});

describe('custom plugin', function() {
  before(onBefore);
  after(onAfter);

  var defaultPlugin = function(opts, callback) {
    return request(opts, callback);
  };

  it('should allow custom plugins', function(done) {
    var mocks = nock(SERVER)
      .get('/')
      .reply(200, { couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488' });

    var cloudant = Cloudant({ plugins: defaultPlugin, account: ME, password: PASSWORD });
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

    Cloudant({ plugins: defaultPlugin, account: ME, password: PASSWORD }, function(err, nano, pong) {
      assert.equal(err, null);
      assert.notEqual(nano, null);
      assert.equal(pong.couchdb, 'Welcome');
      mocks.done();
      done();
    });
  });

  it('should allow custom plugins using asynchronous instantiation with invalid credentials', function(done) {
    const badPass = 'bAD%%Pa$$w0rd123';

    var mocks = nock(SERVER)
        .post('/_session', { name: ME, password: badPass })
        .reply(401, { error: 'unauthorized', reason: 'Name or password is incorrect.' })
        .get('/')
        .reply(401, { error: 'unauthorized', reason: 'Name or password is incorrect.' });

    Cloudant({ plugins: defaultPlugin, account: ME, password: badPass }, function(err, nano) {
      assert.equal(err.error, 'unauthorized');
      assert.equal(nano, null);
      mocks.done();
      done();
    });
  });

  it('should allow custom plugins using asynchronous instantiation with no credentials', function(done) {
    var mocks = nock(SERVER)
        .get('/')
        .reply(200, { couchdb: 'Welcome' });

    Cloudant({ plugins: defaultPlugin, url: SERVER }, function(err, nano, pong) {
      assert.equal(err, null);
      assert.notEqual(nano, null);
      assert.equal(pong.couchdb, 'Welcome');
      mocks.done();
      done();
    });
  });
});
