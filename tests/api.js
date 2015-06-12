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
var ME     = 'nodejs'
var SERVER = 'https://' + ME + '.cloudant.com'


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
      var db = Cloudant({account:ME});
    }).should.not.throw();
  });

  it('supports a ping callback', function(done) {
    nock(SERVER).get('/_session').reply(200, {ok:true, userCtx:{name:null,roles:[]}});
    nock(SERVER).get('/')        .reply(200, {couchdb:'Welcome', version:'1.0.2'});

    Cloudant({account:ME}, function(er, cloudant, body) {
      should(er).equal(null, 'No problem pinging Cloudant');
      cloudant.should.be.an.Object;
      body.should.be.an.Object;
      body.should.have.a.property("couchdb");
      body.should.have.a.property("version");
      body.should.have.a.property("userCtx");
      body.userCtx.should.be.an.Object;
      body.userCtx.should.have.a.property("name");
      body.userCtx.should.have.a.property("roles");
      body.userCtx.roles.should.be.an.Array;
      done();
    });
  });
  
  it('supports instantiation without a callback', function(done) {
    var c = Cloudant({account:ME});
    // check we get a Nano object back
    c.should.be.an.Object;
    c.should.have.property("use");
    c.should.have.property("config");
    c.should.have.property("db");    
    c.should.have.property("relax"); 
    done();
  });
  
});

describe('Authentication', function() {
  
  it('supports Authentication API - POST /_api/v2/api_keys', function(done) {
    done();
  });
  
  
});

describe('CORS', function() {
   
  it('supports CORS API - GET /_api/v2/user/config/cors', function(done) {
    nock(SERVER).get('/_api/v2/user/config/cors').reply(200, { "enable_cors": true, "allow_credentials": true, "origins": ["*"]});
    var c = Cloudant({account:ME});
    c.get_cors(function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("enable_cors");
      d.enable_cors.should.be.a.Boolean;
      d.should.have.a.property("allow_credentials");
      d.allow_credentials.should.be.a.Boolean;
      d.should.have.a.property("origins");
      d.origins.should.be.an.Array;
      done();
    });
  });
  
  it('supports CORS API - PUT /_api/v2/user/config/cors', function(done) {
    nock(SERVER).put('/_api/v2/user/config/cors').reply(200, { "ok": true });
    var c = Cloudant({account:ME});
    c.set_cors({ "enable_cors": true, "allow_credentials": true, "origins": ["*"]}, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      done();
    });
  });
  
});

describe('Authorization', function() {
  
  it('supports Authorization API GET _api/v2/db/<db/_security', function(done) {
    done();
  });
  
  it('supports Authorization API - PUT _api/v2/db/<db/_security', function(done) {
    done();
  });
  
});

describe('Cloudant Query', function() {
  
  it('supports Cloudant Query get indexes - GET /<db/_index', function(done) {
    done();
  });
  
  it('supports Cloudant Query create indexes - POST /<db/_index API call', function(done) {
    done();
  });
  
  it('supports Cloudant Query search - POST /<db/_find API call', function(done) {
    done();
  });
  
  it('supports deleting a Cloudant Query index - DELETE /db/_design/name/type/index', function(done) {
    done();
  });
  
});
