/**
 * Copyright (c) 2015 IBM Cloudant, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

// Cloudant client API tests
require('dotenv').config();

var fs = require('fs');
var should = require('should');
var assert = require('assert');

var nock = require('./nock.js');
var Cloudant = require('../cloudant.js');
var stream = require('stream');


// These globals may potentially be parameterized.
var ME = process.env.cloudant_username || 'nodejs';
var PASSWORD = process.env.cloudant_password || null;
var SERVER = 'https://' + ME + '.cloudant.com';
var MYDB = 'mydb';
var mydb = null;
var cc = null;
var ddoc = null;
var viewname = null;


describe('retry-on-429 plugin', function() {

  it('behave normally too', function(done) {
    var mocks = nock(SERVER).get('/' + MYDB).reply(200, {});
    var cloudant = Cloudant({plugin:'retry', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    this.timeout(10000);
    db.info(function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      done();
    })
  });

  it('allow no callback', function(done) {
    var mocks = nock(SERVER).get('/' + MYDB).reply(200, {});
    var cloudant = Cloudant({plugin:'retry', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    this.timeout(10000);
    db.info();
    setTimeout(done, 1000);
  });

  it('should return a stream', function(done) {
    var mocks = nock(SERVER)
      .get('/' + MYDB).reply(200, { ok: true});
    var cloudant = Cloudant({plugin:'retry', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.info(function() {
      done();
    });
    assert.equal(p instanceof stream.PassThrough, true);
  });
});

describe('promise plugin', function() {

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
      .get('/' + MYDB).reply(200, { ok: true});
    var cloudant = Cloudant({plugin:'promises', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.info().then(function(data) {
      data.should.be.an.Object;
      done();
    });
    assert.equal(p instanceof Promise, true);
  });

  it('should return an error status code', function(done) {
    var mocks = nock(SERVER)
      .get('/' + MYDB).reply(404, { ok: false});
    var cloudant = Cloudant({plugin:'promises', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
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

describe('custom plugin', function() {

  var doNothingPlugin = function(opts, callback) {
    callback(null, { statusCode:200 }, { ok: true});
  };

  it('should allow custom plugins', function(done) {
    var cloudant = Cloudant({plugin: doNothingPlugin, account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    db.info(function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      data.should.have.property.ok;
      data.ok.should.be.a.boolean;
      data.ok.should.equal(true);
      done();
    });
  })

});

describe('cookieauth plugin', function() {
  it('should return a stream', function(done) {
    var mocks = nock(SERVER)
      .post('/_session').reply(200, { ok: true})
      .get('/' + MYDB).reply(200, { ok: true});
    var cloudant = Cloudant({plugin:'cookieauth', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.info(function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      // check that we use all the nocked API calls
      assert.equal(mocks.isDone(), true);
      done();
    });
    assert.equal(p instanceof require('stream').PassThrough, true);
  });

  it('should authenticate before attempting API call', function(done) {
    var mocks = nock(SERVER)
      .post('/_session', {name: ME, password: PASSWORD}).reply(200, { ok: true, info: { }, userCtx: { name: ME, roles: ['_admin']}})
      .get('/' + MYDB + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true});
    var cloudant = Cloudant({plugin:'cookieauth', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      data.should.have.property._id;
      data.should.have.property._rev;
      data.should.have.property.ok;
    
      // check that we use all the nocked API calls
      assert.equal(mocks.isDone(), true);
      done();
    });
  });

  it('should fail with incorrect authentication', function(done) {
    var mocks = nock(SERVER)
      .post('/_session', {name: ME, password: PASSWORD}).reply(401, {error:'unauthorized', reason: 'Name or password is incorrect.'});
    var cloudant = Cloudant({plugin:'cookieauth', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(data, null);
      err.should.be.an.Object;
      err.should.have.property.error;
      err.should.have.property.reason;
    
      // check that we use all the nocked API calls
      assert.equal(mocks.isDone(), true);
      done();
    });
  });

  it('should only authenticate once', function(done) {
    var mocks = nock(SERVER)
      .post('/_session', {name: ME, password: PASSWORD}).reply(200, { ok: true, info: { }, userCtx: { name: ME, roles: ['_admin']}}, { 'Set-Cookie': 'AuthSession=xyz; Version=1; Path=/; HttpOnly' })
      .get('/' + MYDB + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true})
      .get('/' + MYDB + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true});
    var cloudant = Cloudant({plugin:'cookieauth', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
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
        assert.equal(mocks.isDone(), true);
        done();
      });

    });
  });

  it('should not authenticate without credentials', function(done) {
    var mocks = nock(SERVER)
      .get('/' + MYDB + '/mydoc').reply(200, { _id: 'mydoc', _rev: '1-123', ok: true});
    var cloudant = Cloudant({plugin:'cookieauth', url: SERVER});
    var db = cloudant.db.use(MYDB);
    var p = db.get('mydoc', function(err, data) {
      assert.equal(err, null);
      data.should.be.an.Object;
      data.should.have.property._id;
      data.should.have.property._rev;
      data.should.have.property.ok;

      // check that we use all the nocked API calls
      assert.equal(mocks.isDone(), true);
      done();

    });
  });

  it('should work with asynchronous instantiation', function(done) {
    var mocks = nock(SERVER)
      .post('/_session').reply(403, { ok: false})
    var cloudant = Cloudant({plugin:'cookieauth', account:ME, password: PASSWORD}, function(err, data) {
      err.should.be.an.Object;
      assert.equal(mocks.isDone(), true);
      done();
    });
  });

  it('should work with asynchronous instantiation with no credentials', function(done) {
    var mocks = nock(SERVER)
      .get('/_session').reply(403, { ok: false})
     var cloudant = Cloudant({plugin:'cookieauth', url: SERVER}, function(err, data) {
      err.should.be.an.Object;
      assert.equal(mocks.isDone(), true);
      done();
    });
  });

});