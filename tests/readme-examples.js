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

// These tests are all examples from the README.md. For now, they are manually
// synchronized with the README document, a situation I would charitably describe
// as "eventually consistent."
//
// As much as possible, one should copy and paste the examples unmodified, with
// a few exceptions:
//
//   1. require("cloudant") becomes require(CLOUDANT)
//   2. console.log() becomes a should() call to actually confirm the results
//   3. Insert a call to done() when the tests are complete

require('dotenv').config();

var should = require('should');

var nock = require('./nock.js');
var CLOUDANT = '../cloudant.js'


describe('Getting Started', function() {
  this.timeout(10 * 1000);

  nock('https://nodejs.cloudant.com').get('/_all_dbs').reply(200, ['database_changes', 'third_party_db']);

  it('Example 1', function(done) {
    // Load the Cloudant library.
    var Cloudant = require(CLOUDANT);

    var me = 'nodejs'; // Set this to your own account
    var password = process.env.cloudant_password;

    // Initialize the library with my account.
    var cloudant = Cloudant({account:me, password:password});

    cloudant.db.list(function(err, allDbs) {
      should(err).equal(null);
      allDbs.should.be.an.instanceOf(Array);
      done();
    });
  });
});
