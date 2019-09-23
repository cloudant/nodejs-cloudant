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

// These tests are all examples from the README.md. For now, they are manually
// synchronized with the README document, a situation I would charitably describe
// as "eventually consistent."
//
// As much as possible, one should copy and paste the examples unmodified, with
// a few exceptions:
//
//   1. Append should() calls after console.log() to actually confirm the results
//   2. Insert a call to done() when the tests are complete

require('dotenv').config({silent: true});

var should = require('should');
var nock = require('../nock.js');
const uuid = require('uuid/v4');
var ME = process.env.cloudant_username || 'nodejs';
var PASSWORD = process.env.cloudant_password || 'sjedon';
var SERVER = process.env.SERVER_URL || 'https://' + ME + '.cloudant.com';
const COOKIEAUTH_PLUGIN = [ { cookieauth: { autoRenew: false } } ];

const MOCK_COOKIE = 'AuthSession=Y2xbZWr0bQlpcc19ZQN8OeU4OWFCNYcZOxgdhy-QRDp4i6JQrfkForX5OU5P';
const MOCK_SET_COOKIE_HEADER = { 'set-cookie': `${MOCK_COOKIE}; Version=1; Max-Age=86400; Path=/; HttpOnly` };

var real_require = require;
require = function(module) {
  return (module == '@cloudant/cloudant')
    ? real_require('../../cloudant.js')
    : real_require.apply(this, arguments);
};

// Disable console.log
var console = { log: function() {} };
const alice = `nodejs_cloudant_test_${uuid()}`
const my_db = `nodejs_cloudant_test_${uuid()}`

if (SERVER.endsWith('.cloudant.com')) {
  describe('#db Getting Started', function() {
    var mocks;
    after(function(done) {
      var Cloudant = require('@cloudant/cloudant');
      var cloudant = Cloudant({account: ME, password: PASSWORD, plugins: 'retry'});
      cloudant.db.destroy(alice, function(er, d) {
        should(er).equal(null);
        d.should.be.an.Object;
        d.should.have.a.property('ok');
        d.ok.should.be.equal(true);

        mocks.done();
        done();
      });
    });
    before(function() {
      mocks = nock(SERVER)
        .get('/_all_dbs').reply(200, ['database_changes', 'third_party_db'])
        .delete(`/${alice}`).reply(404, {error: 'not_found', reason: 'Database does not exist.'})
        .put(`/${alice}`).reply(201, {ok: true})
        .put(`/${alice}/rabbit`).reply(201, {ok: true, id: 'rabbit', rev: '1-6e4cb465d49c0368ac3946506d26335d'})
        .delete(`/${alice}`).reply(200, {ok: true});
    });

    it('Example 1', function(done) {
      // Load the Cloudant library.
      var Cloudant = require('@cloudant/cloudant');

      var me = ME; // Set this to your own account
      var password = process.env.cloudant_password || 'sjedon';

      // Initialize the library with my account.
      var cloudant = Cloudant({account: me, password: password, plugins: 'retry'});

      cloudant.db.list(function(err, allDbs) {
        should(err).equal(null);
        allDbs.should.be.an.instanceOf(Array);
        done();
      });
    });

    it('Example 2', function(done) {
      // Load the Cloudant library.
      var Cloudant = require('@cloudant/cloudant');

      // Initialize Cloudant with settings from .env
      var username = ME;
      var password = process.env.cloudant_password || 'sjedon';
      var cloudant = Cloudant({account: username, password: password, plugins: 'retry'});

      // Remove any existing database called "alice".
      cloudant.db.destroy(alice, function(err) {
        // Create a new "alice" database.
        cloudant.db.create(alice, function() {
          // Specify the database we are going to use (alice)...
          var aliceDb = cloudant.db.use(alice);

          // ...and insert a document in it.
          aliceDb.insert({ crazy: true }, 'rabbit', function(err, body, header) {
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

  describe('#db Initialization', function() {
    var mocks;
    after(function() {
      mocks.done();
    });
    before(function() {
      mocks = nock(SERVER)
        .post('/_session').reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get('/').reply(200, {couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488'})
        .get('/animaldb/dog').reply(404, {error: 'not_found', reason: 'missing'});
    });

    it('Example 1', function(done) {
      var Cloudant = require('@cloudant/cloudant');
      var me = ME; // Replace with your account.
      var password = process.env.cloudant_password || 'sjedon';

      Cloudant({account: me, password: password}, function(err, cloudant) {
        if (err) {
          return console.log('Failed to initialize Cloudant: ' + err.message);
        }

        var db = cloudant.db.use('animaldb');
        db.get('dog', function(err, data) {
          // The rest of your code goes here. For example:
          err.should.be.an.Object.have.a.property('error').equal('not_found');
          done();
        });
      });
    });
  });

  describe('Password authentication', function() {
    var mocks;
    after(function() {
      if (!process.env.NOCK_OFF) {
        mocks.done();
      }
    });
    before(function() {
      if (process.env.NOCK_OFF) {
        this.skip();
      }
      mocks = nock(SERVER)
        .post('/_session').reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .get('/').reply(200, {couchdb: 'Welcome', version: '1.0.2', cloudant_build: '2488'});
    });

    it('Example 1', function(done) {
      var Cloudant = require('@cloudant/cloudant');

      Cloudant({account: ME, password: PASSWORD, plugins: COOKIEAUTH_PLUGIN}, function(er, cloudant, reply) {
        if (er) {
          throw er;
        }
        reply.should.be.an.Object.have.a.property('couchdb')
        done();
      });
    });
  });

  describe('Cloudant Local', function() {
    // No tests!
  });

  describe('Authorization and API Keys', function() {
    var mocks;
    after(function() {
      if (!process.env.NOCK_OFF) {
        mocks.done();
      }
    });
    before(function() {
      if (process.env.NOCK_OFF) {
        this.skip();
      }
      mocks = nock(SERVER)
        .post('/_api/v2/api_keys')
        .reply(200, { 'password': 'Eivln4jPiLS8BoTxjXjVukDT', 'ok': true, 'key': 'thandoodstrenterprourete' })
        .put('/_api/v2/db/animaldb/_security')
        .reply(200, {ok: true})
        .get('/_api/v2/db/animaldb/_security')
        .reply(200, {cloudant: {nobody: [], thandoodstrenterprourete: ['_reader', '_writer'], fred: ['_reader', '_writer', '_admin', '_replicator']}});
    });

    it('Example 1', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var Cloudant = require('@cloudant/cloudant');
      var me = ME; // Replace with your account.
      var password = process.env.cloudant_password || 'sjedon';
      var cloudant = Cloudant({account: me, password: password, plugins: 'retry'});

      cloudant.generate_api_key(function(er, api) {
        if (er) {
          throw er; // You probably want wiser behavior than this.
        }

        api.should.be.an.Object.and.have.a.property('key');
        console.log('API key: %s', api.key);
        console.log('Password for this key: %s', api.password);
        console.log('');

        // Set the security for three users: nobody, fred, and the above API key.
        var db = 'animaldb';
        var security = {
          nobody: [],
          fred: [ '_reader', '_writer', '_admin', '_replicator' ]
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

  describe('CORS #db', function() {
    var mocks;
    after(function() { mocks.done(); });
    before(function() {
      mocks = nock(SERVER)
        .put('/_api/v2/user/config/cors')
        .reply(200, {ok: true})
        .put('/_api/v2/user/config/cors')
        .reply(200, {ok: true})
        .put('/_api/v2/user/config/cors')
        .reply(200, {ok: true})
        .get('/_api/v2/user/config/cors')
        .reply(200, { enable_cors: false, allow_credentials: false, origins: [] });
    });

    var cloudant;
    before(function() {
      var Cloudant = require('@cloudant/cloudant');
      cloudant = Cloudant({account: ME, password: PASSWORD, plugins: 'retry'});
    });

    it('Example 1', function(done) {
      cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: ['*']}, function(err, data) {
        should(err).equal(null);
        data.should.have.a.property('ok').equal(true);
        console.log(err, data);
        done();
      });
    });

    it('Example 2', function(done) {
      cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: [ 'https://mydomain.com', 'https://mysubdomain.mydomain.com']}, function(err, data) {
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

  describe('Cloudant Query #db', function() {
    var mocks;
    before(function() {
      mocks = nock(SERVER)
        .put(`/${my_db}`)
        .reply(200, {ok: true})
        .get(`/${my_db}/_index`)
        .reply(200, {indexes: [ {name: '_all_docs', type: 'special', def: {fields: [{_id: 'asc'}]}} ]})
        .post(`/${my_db}/_index`)
        .reply(200, { result: 'created', id: '_design/778580d5684fd367424e39735f7857f2e9fb0eb9', name: 'first-name' })
        .post(`/${my_db}/_find`)
        .reply(200, {docs: []})
        .delete(`/${my_db}`)
        .reply(200, {ok: true});
    });

    var cloudant, db;
    before(function(done) {
      var Cloudant = require('@cloudant/cloudant');
      cloudant = Cloudant({account: ME, password: PASSWORD, plugins: 'retry'});
      cloudant.db.create(my_db, function(er) {
        if (er) throw er;
        db = cloudant.db.use(my_db);
        done();
      });
    });
    after(function(done) {
      cloudant.db.destroy(my_db, function(er) {
        if (er) throw er;
        mocks.done();
        done();
      });
    });

    it('Example 1', function(done) {
      db.index(function(er, result) {
        if (er) {
          throw er;
        }

        console.log('The database has %d indexes', result.indexes.length);
        for (var i = 0; i < result.indexes.length; i++) {
          console.log('  %s (%s): %j', result.indexes[i].name, result.indexes[i].type, result.indexes[i].def);
        }

        result.should.have.a.property('indexes').which.is.an.Array;
        done();
      });
    });

    it('Example 2', function(done) {
      var first_name = {name: 'first-name', type: 'json', index: {fields: ['name']}};
      db.index(first_name, function(er, response) {
        if (er) {
          throw er;
        }

        console.log('Index creation result: %s', response.result);
        response.should.have.a.property('result').which.is.equal('created');
        done();
      });
    });

    it('Example 3', function(done) {
      db.find({selector: {name: alice}}, function(er, result) {
        if (er) {
          throw er;
        }

        console.log('Found %d documents with name Alice', result.docs.length);
        for (var i = 0; i < result.docs.length; i++) {
          console.log('  Doc id: %s', result.docs[i]._id);
        }

        result.should.have.a.property('docs').which.is.an.Array;
        done();
      });
    });
  });

  describe('Cloudant Search #db', function() {
    var mocks;
    before(function() {
      mocks = nock(SERVER)
        .put(`/${my_db}`)
        .reply(200, {ok: true})
        .post(`/${my_db}/_bulk_docs`)
        .reply(200, [ { id: '764de7aeca95c27fdd7fb6565dcfc0fe', rev: '1-eadaf74c0058257fcb498c3017dde3e5' },
                      { id: '764de7aeca95c27fdd7fb6565dcfc4f5', rev: '1-c22d5563f4b9cddde6f26a47cd1ce88f' },
                      { id: '764de7aeca95c27fdd7fb6565dcfc727', rev: '1-86039ff130d36c08a71b3f293fd4ea7e' }])
        .post(`/${my_db}`)
        .reply(200, { ok: true, id: '_design/library', rev: '1-cdbb57f890d060055b7fb8cb07628068' })
        .post(`/${my_db}/_design/library/_search/books`, '{\"q\":\"author:dickens\"}')
        .reply(200, {total_rows: 2, rows: [{id: '764de7aeca95c27fdd7fb6565dcfc0fe'}, {id: '764de7aeca95c27fdd7fb6565dcfc727'}]})
        .delete(`/${my_db}`)
        .reply(200, {ok: true});
    });

    var cloudant, db;
    before(function(done) {
      var Cloudant = require('@cloudant/cloudant');
      cloudant = Cloudant({account: ME, password: PASSWORD, plugins: 'retry'});
      cloudant.db.create(my_db, function(er) {
        if (er) throw er;
        db = cloudant.db.use(my_db);
        done();
      });
    });
    after(function(done) {
      cloudant.db.destroy(my_db, function(er) {
        if (er) throw er;
        mocks.done();
        done();
      });
    });

    it('Example 1', function(done) {
      var books = [
        {author: 'Charles Dickens', title: 'David Copperfield'},
        {author: 'David Copperfield', title: 'Tales of the Impossible'},
        {author: 'Charles Dickens', title: 'Great Expectation'}
      ];

      db.bulk({docs: books}, function(er) {
        if (er) {
          throw er;
        }

        console.log('Inserted all documents');
        done();
      });
    });

    it('Example 2', function(done) {
      // Note, you can make a normal JavaScript function. It is not necessary
      // for you to convert it to a string as with other languages and tools.
      var book_indexer = function(doc) {
        if (doc.author && doc.title) {
          // This looks like a book.
          index('title', doc.title);
          index('author', doc.author);
        }
      };

      var ddoc = {
        _id: '_design/library',
        indexes: {
          books: {
            analyzer: {name: 'standard'},
            index: book_indexer
          }
        }
      };

      db.insert(ddoc, function(er, result) {
        if (er) {
          throw er;
        }

        console.log('Created design document with books index');

        result.should.have.a.property('ok').which.equal(true);
        done();
      });
    });

    it('Example 3', function(done) {
      db.search('library', 'books', {q: 'author:dickens'}, function(er, result) {
        if (er) {
          throw er;
        }

        console.log('Showing %d out of a total %d books by Dickens', result.rows.length, result.total_rows);
        for (var i = 0; i < result.rows.length; i++) {
          console.log('Document id: %s', result.rows[i].id);
        }

        result.should.have.a.property('rows').of.length(2);
        done();
      });
    });
  });

  describe('Cookie Authentication #db', function() {
    var cloudant;
    var mocks;
    after(function(done) {
      var Cloudant = require('@cloudant/cloudant');
      cloudant = Cloudant({account: ME, password: PASSWORD, plugins: []});
      cloudant.db.destroy(alice, function() {
        mocks.done();
        done();
      });
    });
    before(function(done) {
      mocks = nock(SERVER)
        .post('/_session').reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
        .put(`/${alice}`).reply(200, { ok: true })
        .post(`/${alice}`).reply(200, { ok: true, id: '72e0367f3e195340e239948164bbb7e7', rev: '1-feb5539029f4fc50dc3f827b164a2088' })
        .get('/_session').reply(200, {ok: true, userCtx: {name: ME, roles: ['_admin', '_reader', '_writer']}})
        .delete(`/${alice}`).reply(200, {ok: true});

      var Cloudant = require('@cloudant/cloudant');
      cloudant = Cloudant({account: ME, password: PASSWORD, plugins: []});
      cloudant.db.create(alice, function() {
        done();
      });
    });

    var cookies;

    it('Example 1', function(done) {
      var Cloudant = require('@cloudant/cloudant');
      var username = ME; // Set this to your own account
      var password = process.env.cloudant_password || 'sjedon';
      var cloudant = Cloudant({account: username, password: password, plugins: []});

      // A global variable to store the cookies. Of course, you can store cookies any way you wish.
      // var cookies = {}
      cookies = {};

      // In this example, we authenticate using the same username/userpass as above.
      // However, you can use a different combination to authenticate as other users
      // in your database. This can be useful for using a less-privileged account.
      cloudant.auth(username, password, function(er, body, headers) {
        if (er) {
          return console.log('Error authenticating: ' + er.message);
        }

        console.log('Got cookie for %s: %s', username, headers['set-cookie']);

        // Store the authentication cookie for later.
        cookies[username] = headers['set-cookie'];

        console.log('headers %j', headers);
        headers.should.have.a.property('set-cookie')
        done();
      });
    });

    it('Example 2', function(done) {
      // Make a new connection with the cookie.
      var Cloudant = require('@cloudant/cloudant');
      var username = ME; // Set this to your own account
      var other_cloudant = Cloudant({account: username, cookie: cookies[username], plugins: []});

      var aliceDb = other_cloudant.db.use(alice);
      aliceDb.insert({'I use cookies': true}, function(er, body, headers) {
        if (er) {
          return console.log('Failed to insert into alice database: ' + er.message);
        }

        // Change the cookie if Cloudant tells us to.
        if (headers && headers['set-cookie']) {
          cookies[username] = headers['set-cookie'];
        }

        console.log(body);

        body.should.have.a.property('ok').which.is.equal(true);
        done();
      });
    });

    it('Example 3', function(done) {
      // (Presuming the "cookie" global from the above example is still in scope.)

      var Cloudant = require('@cloudant/cloudant');
      var username = ME; // Set this to your own account
      var cloudant = Cloudant({account: username, cookie: cookies[username], plugins: []});

      cloudant.session(function(er, session) {
        if (er) {
          return console.log('oh noes!');
        }

        console.log('user is %s and has these roles: %j',
          session.userCtx.name, session.userCtx.roles);

        session.should.have.a.property('userCtx').which.is.an.Object;
        done();
      });
    });
  });
}
