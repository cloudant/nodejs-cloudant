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
//   1. Append should() calls after console.log() to actually confirm the results
//   2. Insert a call to done() when the tests are complete

require('dotenv').config();

var should = require('should');

var nock = require('./nock.js');

var real_require = require;
require = function(module) {
  return (module == 'cloudant')
    ? real_require('../cloudant.js')
    : real_require.apply(this, arguments);
}

// Disable console.log
var console = { log: function() {} };


describe('Getting Started', function() {
  this.timeout(10 * 1000);

  var mocks;
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .get('/_all_dbs').reply(200, ['database_changes', 'third_party_db'])
      .delete('/alice').reply(404, {error:'not_found', reason:'Database does not exist.'})
      .put('/alice').reply(201, {ok:true})
      .put('/alice/rabbit').reply(201, {ok:true, id:'rabbit', rev:'1-6e4cb465d49c0368ac3946506d26335d'});
  });

  after(function() {
    mocks.done();
  });

  it('Example 1', function(done) {
    // Load the Cloudant library.
    var Cloudant = require('cloudant');

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

  it('Example 2', function(done) {
    require('dotenv').load();

    // Load the Cloudant library.
    var Cloudant = require('cloudant');

    // Initialize Cloudant with settings from .env
    var username = process.env.cloudant_username || "nodejs";
    var password = process.env.cloudant_password;
    var cloudant = Cloudant({account:username, password:password});

    // Remove any existing database called "alice".
    cloudant.db.destroy('alice', function(err) {

      // Create a new "alice" database.
      cloudant.db.create('alice', function() {

        // Specify the database we are going to use (alice)...
        var alice = cloudant.db.use('alice')

        // ...and insert a document in it.
        alice.insert({ crazy: true }, 'rabbit', function(err, body, header) {
          if (err) {
            return console.log('[alice.insert] ', err.message);
          }

          should(err).equal(null);
          body.should.be.an.instanceOf(Object);
          body.ok.should.be.equal(true);
          body.id.should.be.equal('rabbit');
          body.should.have.a.property('rev').which.is.instanceOf(String);
          done();
        });
      });
    });
  });
});

describe('Initialization', function() {
  this.timeout(10 * 1000);

  var mocks;
  after(function() { mocks.done(); });
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .get('/_session').reply(200, {ok:true, userCtx:{name:'nodejs', roles:[]}})
      .get('/').reply(200, {couchdb:'Welcome', version:'1.0.2', cloudant_build:'2488'})
      .get('/animals/dog').reply(404, {error:'not_found', reason:'missing'});
  });

  it('Example 1', function(done) {
    var Cloudant = require('cloudant');
    var me = 'nodejs'; // Replace with your account.
    var password = process.env.cloudant_password;

    Cloudant({account:me, password:password}, function(err, cloudant) {
      if (err) {
        return console.log('Failed to initialize Cloudant: ' + err.message);
      }

      var db = cloudant.db.use("animals");
      db.get("dog", function(err, data) {
        // The rest of your code goes here. For example:
        err.should.be.an.Object.have.a.property('error').equal('not_found')
        done();
      });
    });
  });
});

describe('Password authentication', function() {
  var mocks;
  after(function() { mocks.done(); });
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .get('/_session').reply(200, {XXXXX:'YYYYYYYYYY', ok:true, userCtx:{name:'jhs', roles:[]}})
      .get('/').reply(200, {couchdb:'Welcome!!!!!', version:'1.0.2', cloudant_build:'2488'});
  });

  it('Example 1', function(done) {
    var Cloudant = require('cloudant');
    var me = "nodejs";         // Substitute with your Cloudant user account.
    var otherUsername = "jhs"; // Substitute with some other Cloudant user account.
    var otherPassword = process.env.other_cloudant_password;

    Cloudant({account:me, username:otherUsername, password:otherPassword}, function(er, cloudant, reply) {
      if (er) {
        throw er;
      }

      reply.userCtx.should.be.an.Object.have.a.property('name').equal(otherUsername);
      done();
    });
  });
});

describe('Cloudant Local', function() {
  // No tests!
});

describe('Authorization and API Keys', function() {
  this.timeout(20 * 1000);

  var mocks;
  after(function() { mocks.done(); });
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .post('/_api/v2/api_keys')
      .reply(200, { "password": "Eivln4jPiLS8BoTxjXjVukDT", "ok": true, "key": "thandoodstrenterprourete" })
      .put('/_api/v2/db/animals/_security')
      .reply(200, {ok: true})
      .get('/_api/v2/db/animals/_security')
      .reply(200,{cloudant:{nobody:[],thandoodstrenterprourete:['_reader','_writer'],fred:['_reader','_writer','_admin','_replicator']}});
  });

  it('Example 1', function(done) {
    var Cloudant = require('cloudant');
    var me = 'nodejs'; // Replace with your account.
    var password = process.env.cloudant_password;
    var cloudant = Cloudant({account:me, password:password});

    cloudant.generate_api_key(function(er, api) {
      if (er) {
        throw er; // You probably want wiser behavior than this.
      }

      api.should.be.an.Object.and.have.a.property('key');
      console.log('API key: %s', api.key);
      console.log('Password for this key: %s', api.password);
      console.log('');

      // Set the security for three users: nobody, fred, and the above API key.
      var db = "animals";
      var security = {
        nobody: [],
        fred : [ '_reader', '_writer', '_admin', '_replicator' ]
      };
      security[api.key] = [ '_reader', '_writer' ];

      var my_database = cloudant.db.use(db);
      my_database.set_security(security, function(er, result) {
        if (er) {
          throw er;
        }

        result.should.be.an.Object.and.have.a.property('ok');
        console.log('Set security for ' + db);
        console.log(result);
        console.log('');

        // Or you can read the security settings from a database.
        my_database.get_security(function(er, result) {
          if (er) {
            throw er;
          }

          result.should.be.an.Object.and.have.a.property('cloudant');
          console.log('Got security for ' + db);
          console.log(result);
          done();
        });
      });
    });
  });
});

describe('CORS', function() {
  this.timeout(10 * 1000);

  var mocks;
  after(function() { mocks.done(); });
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .put('/_api/v2/user/config/cors')
      .reply(200, {ok:true})
      .put('/_api/v2/user/config/cors')
      .reply(200, {ok:true})
      .put('/_api/v2/user/config/cors')
      .reply(200, {ok:true})
      .get('/_api/v2/user/config/cors')
      .reply(200, { enable_cors: false, allow_credentials: false, origins: [] });
  });

  var cloudant;
  before(function() {
    var Cloudant = require('cloudant');
    cloudant = Cloudant({account:'nodejs', password:process.env.cloudant_password});
  });

  it('Example 1', function(done) {
    cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: ["*"]}, function(err, data) {
      should(err).equal(null);
      data.should.have.a.property('ok').equal(true);
      console.log(err, data);
      done();
    });
  });

  it('Example 2', function(done) {
    cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: [ "https://mydomain.com","https://mysubdomain.mydomain.com"]}, function(err, data) {
      should(err).equal(null);
      data.should.have.a.property('ok').equal(true);
      console.log(err, data);
      done();
    });
  });

  it('Example 3', function(done) {
    cloudant.set_cors({ enable_cors: false, origins: [] }, function(err, data) {
      should(err).equal(null);
      data.should.have.a.property('ok').equal(true);
      console.log(err, data);
      done();
    });
  });

  it('Example 4', function(done) {
    cloudant.get_cors(function(err, data) {
      data.should.have.a.property('enable_cors');
      console.log(data);
      done();
    });
  });
});

describe('Virtual Hosts', function() {
  this.timeout(10 * 1000);

  var mocks;
  after(function() { mocks.done(); });
  before(function() {
    mocks = nock('https://nodejs.cloudant.com')
      .post('/_api/v2/user/virtual_hosts')
      .reply(200, {ok:true})
      .get('/_api/v2/user/virtual_hosts')
      .reply(200, { virtual_hosts: [ [ 'mysubdomain.mydomain.com', '/mypath' ] ] })
      .delete('/_api/v2/user/virtual_hosts')
      .reply(200, {ok:true});
  });

  var cloudant;
  before(function() {
    var Cloudant = require('cloudant');
    cloudant = Cloudant({account:'nodejs', password:process.env.cloudant_password});
  });

  it('Example 1', function(done) {
    cloudant.add_virtual_host({ host: "mysubdomain.mydomain.com", path: "/mypath"}, function(err, data) {
      console.log(err, data);
      data.should.have.a.property('ok').which.is.equal(true);
      done();
    });
  });

  it('Example 2', function(done) {
    cloudant.get_virtual_hosts(function(err, data) {
      console.log(err, data);
      data.should.have.a.property('virtual_hosts').which.is.an.Array;
      done();
    });
  });

  it('Example 3', function(done) {
    cloudant.delete_virtual_host({ host: "mysubdomain.mydomain.com", path: "/mypath"}, function(err, data) {
      console.log(err, data);
      data.should.have.a.property('ok').which.is.equal(true);
      done();
    });
  });
});
