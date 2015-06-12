// Licensed under the Apache License, Version 2.0 (the 'License'); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

// Cloudant client API tests

var should = require('should');
var nock = require('./nock.js');

var Cloudant = require('../cloudant.js');


// These globals may potentially be parameterized.
var SERVER = 'https://nodejs.cloudant.com'
var ME     = 'nodejs'


describe('Cloudant API', function() {
  it('is a function', function() {
    Cloudant.should.be.type('function');
  });
  it('has arity 2: options, callback', function() {
    Cloudant.should.have.lengthOf(2);
  });
});

describe('Initialization', function() {
  it('runs synchronously with one argument', function() {
    (function() {
      var db = Cloudant({account:'nodejs'});
    }).should.not.throw();
  });

  it('supports a ping callback', function(done) {
    nock(SERVER).get('/_session').reply(200, {ok:true, userCtx:{name:null,roles:[]}});
    nock(SERVER).get('/')        .reply(200, {couchdb:'Welcome', version:'1.0.2'});

    Cloudant({account:'nodejs'}, function(er, cloudant, body) {
      should(er).equal(null, 'No problem pinging Cloudant');
      cloudant.should.be.an.Object;
      body.should.be.an.Object;
      body.should.have.a.property("couchdb").and.not.be.empty;
      body.should.have.a.property("version").and.not.be.empty;
      body.should.have.a.property("userCtx").and.be.an.Object;
      body.userCtx.should.have.a.property("name");
      body.userCtx.should.have.a.property("roles").and.be.an.Array;
      done();
    });
  });
});
