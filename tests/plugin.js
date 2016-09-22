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
  })
});

describe('promise plugin', function() {

  it('should return a promise', function(done) {
    var mocks = nock(SERVER)
      .get('/' + MYDB).reply(200, {});
    var cloudant = Cloudant({plugin:'promises', account:ME, password: PASSWORD});
    var db = cloudant.db.use(MYDB);
    var p = db.info().then(function(data) {
      data.should.be.an.object;
      done();
    });
    assert.equal(p instanceof Promise, true);
  })

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
