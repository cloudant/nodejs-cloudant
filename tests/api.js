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
require('dotenv').config();

var should = require('should');

var nock = require('./nock.js');
var Cloudant = require('../cloudant.js');


// These globals may potentially be parameterized.
var ME     = 'nodejs'
var PASSWORD = process.env.cloudant_password || null;
var SERVER = 'https://' + ME + '.cloudant.com';
var MYDB = 'mydb';
var mydb = null;
var cc = null;
var ddoc = null;
var viewname = null;


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
    nock(SERVER).post('/_api/v2/api_keys').reply(200, { "password": "Eivln4jPiLS8BoTxjXjVukDT", "ok": true, "key": "thandoodstrenterprourete" });
    var c = Cloudant({account:ME, password:PASSWORD});
    c.generate_api_key(function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("password");
      d.password.should.be.a.String;
      d.should.have.a.property("ok");
      d.ok.should.be.a.Boolean;
      d.should.have.a.property("key");
      d.key.should.be.a.String;
      done();
    });
  });
});

describe('CORS', function() {
  it('supports CORS API - GET /_api/v2/user/config/cors', function(done) {
    nock(SERVER).get('/_api/v2/user/config/cors').reply(200, { "enable_cors": true, "allow_credentials": true, "origins": ["*"]});
    var c = Cloudant({account:ME, password:PASSWORD});
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
    var c = Cloudant({account:ME, password:PASSWORD});
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
  before(function(done) {
    nock(SERVER).put('/' + MYDB).reply(200, { "ok": true });
    cc = Cloudant({account:ME, password:PASSWORD});
    cc.db.create(MYDB, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      mydb = cc.db.use("mydb");
      done();
    });
  });

  it('supports Authorization API GET _api/v2/db/<db>/_security', function(done) {
    nock(SERVER).get('/_api/v2/db/' + MYDB + '/_security').reply(200, { });
    mydb.get_security(function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.be.empty;
      done();
    });
  });

  it('supports Authorization API - PUT _api/v2/db/<db/_security', function(done) {
    nock(SERVER).put('/_api/v2/db/' + MYDB + '/_security').reply(200, { "ok": true });
    mydb.set_security({ "nobody": ["_reader"]}, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      done();
    });
  });

  after(function(done) {
    nock(SERVER).delete('/' + MYDB).reply(200, { "ok": true });
    cc.db.destroy(MYDB, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      mydb = null;
      cc = null;
      done();
    });
  });
});

describe('Cloudant Query', function() {
  before(function(done) {
    nock(SERVER).put('/' + MYDB).reply(200, { "ok": true });
    cc = Cloudant({account:ME, password:PASSWORD});
    cc.db.create(MYDB, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      mydb = cc.db.use("mydb");
      ddoc = viewname = null;
      done();
    });
  });

  it('create some dummy data', function(done) {
    nock(SERVER).post('/' + MYDB + '/_bulk_docs').reply(200, [{"id":"f400bde9395b9116d108ebc89aa816b8","rev":"1-23202479633c2b380f79507a776743d5"},{"id":"f400bde9395b9116d108ebc89aa81bb8","rev":"1-3975759ccff3842adf690a5c10caee42"},{"id":"f400bde9395b9116d108ebc89aa82127","rev":"1-027467bd0efec85f21c822a8eb537073"}]);
    mydb.bulk({docs: [ {a:1},{a:2}, {a:3} ]}, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Array;
      for (var i in d) {
        d[i].should.be.an.Object;
        d[i].should.have.a.property("id");
        d[i].should.have.a.property("rev");
      }
      done();
    });
  });

  it('supports Cloudant Query create indexes - POST /<db/_index API call', function(done) {
    nock(SERVER).post('/' + MYDB + '/_index').reply(200, {"result":"created","id":"_design/32372935e14bed00cc6db4fc9efca0f1537d34a8","name":"32372935e14bed00cc6db4fc9efca0f1537d34a8"});
    mydb.index( { "index": {}, "type": "text"}, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("result");
      d.result.should.be.a.String;
      d.result.should.be.equal("created");
      d.should.have.a.property("id");
      d.should.have.a.property("name");
      ddoc = d.id.replace(/_design\//,"");
      viewname = d.name;
      done();
    });

  });

  it('supports Cloudant Query get indexes - GET /<db/_index', function(done) {
    nock(SERVER).get('/' + MYDB + '/_index').reply(200, {"indexes":[{"ddoc":null,"name":"_all_docs","type":"special","def":{"fields":[{"_id":"asc"}]}},{"ddoc":"_design/32372935e14bed00cc6db4fc9efca0f1537d34a8","name":"32372935e14bed00cc6db4fc9efca0f1537d34a8","type":"text","def":{"default_analyzer":"keyword","default_field":{},"selector":{},"fields":[]}}]} );
    mydb.index(function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("indexes");
      d.indexes.should.be.an.Array;
      for (var i in d.indexes) {
        d.indexes[i].should.be.an.Object;
        d.indexes[i].should.have.a.property("ddoc");
        if (typeof d.indexes[i].ddoc == "string" && d.indexes[i].ddoc.indexOf("_design") === 0) {
          d.indexes[i].should.have.a.property("type");
          d.indexes[i].type.should.equal("text");
        }
      }
      done();
    });
  });

  it('supports Cloudant Query search - POST /<db/_find API call', function(done) {
    var query = { "selector": { "a": { "$gt": 2 }}};
    nock(SERVER).post('/' + MYDB + '/_find', query).reply(200, {"docs":[ {"_id":"f400bde9395b9116d108ebc89aa82127","_rev":"1-027467bd0efec85f21c822a8eb537073","a":3}],"bookmark": "g2wAAAABaANkABxkYmNvcmVAZGIyLm1lYWQuY2xvdWRhbnQubmV0bAAAAAJhAGI_____amgCRj_wAAAAAAAAYQFq"} );
    mydb.find( query, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("docs");
      d.docs.should.be.an.Array;
      d.docs.should.have.a.length(1);
      d.docs[0].should.have.a.property("a");
      d.docs[0].a.should.be.a.Number;
      d.docs[0].a.should.be.equal(3);
      done();
    });
  });

  it('supports deleting a Cloudant Query index - DELETE /db/_design/ddocname/type/viewname', function(done) {
    var path = '/' + MYDB + '/_index/' + ddoc + '/text/' + viewname;
    nock(SERVER).delete(path).reply(200, {"ok":true} );
    mydb.index.del({ ddoc: ddoc, name: viewname, type:"text"}, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      done();
    });
  });

  after(function(done) {
    nock(SERVER).delete('/' + MYDB).reply(200, { "ok": true });
    cc.db.destroy(MYDB, function(er, d) {
      should(er).equal(null);
      d.should.be.an.Object;
      d.should.have.a.property("ok");
      d.ok.should.be.equal(true);
      mydb = null;
      cc = null;
      ddoc = viewname = null;
      done();
    });
  });
});
