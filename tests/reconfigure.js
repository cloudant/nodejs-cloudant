var should = require('should');
var reconfigure = require('../lib/reconfigure.js');
var assert = require('assert');

describe('Reconfigure', function() {
  
  it('is a function', function(done) {
    reconfigure.should.be.a.Function;
    done();
  });
  
  it('has arity 1: credentials', function(done) {
    reconfigure.should.have.lengthOf(1);
    done();
  });
  
  it('allows only an account to be passed in', function(done) {
    var credentials = { account: "myaccount"};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://myaccount.cloudant.com");
    done();
  });
  
  it('allows an account and a password to be passed in', function(done) {
    var credentials = { account: "myaccount", password: "mypassword"};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://myaccount:mypassword@myaccount.cloudant.com");
    done();
  });
  
  it('allows a key and an account and a password to be passed in', function(done) {
    var credentials = { account: "myaccount", password: "mypassword", key: "mykey"};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://mykey:mypassword@myaccount.cloudant.com");
    done();
  });
  
  it('allows a username and an account and a password to be passed in', function(done) {
    var credentials = { account: "myaccount", password: "mypassword", username: "myusername"};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://myusername:mypassword@myaccount.cloudant.com");
    done();
  });
  
  it('allows a key and an full domain and a password to be passed in', function(done) {
    var credentials = { account: "myaccount.cloudant.com", password: "mypassword", key: "mykey"};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://mykey:mypassword@myaccount.cloudant.com");
    done();
  });
  
  it('allows complex passwords', function(done) {
    var credentials = { account: "myaccount", password: "mypassword[]{}!#&="};
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://myaccount:mypassword%5B%5D%7B%7D!%23%26%3D@myaccount.cloudant.com");
    done();
  });
  
  it('allows a local CouchDB url to used', function(done) {
    var credentials = { url: "http://localhost:5984" };
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("http://localhost:5984");
    done();
  });
  
  it('allows an HTTP Cloudant URL - switching to HTTPS', function(done) {
    var credentials = { url: "http://mykey:mypassword@mydomain.cloudant.com" };
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://mykey:mypassword@mydomain.cloudant.com");
    done();
  });
  
  it('allows an HTTP Cloudant URL with a port number - switching to HTTPS', function(done) {
    var credentials = { url: "http://mykey:mypassword@mydomain.cloudant.com:80" };
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://mykey:mypassword@mydomain.cloudant.com");
    done();
  });
  
  // Issue cloudant/nodejs-cloudant#129
  it('fixes a Cloudant URL with a trailing / - removing the /', function(done) {
    var credentials = { url: "https://mykey:mypassword@mydomain.cloudant.com/" };
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://mykey:mypassword@mydomain.cloudant.com");
    done();
  });

  // Issue cloudant/nodejs-cloudant#141
  it('Allows account names with dashes', function(done) {
    var credentials = { account: "this-account-has-dashes.cloudant.com", password: "bacon" };
    var url = reconfigure(credentials);
    url.should.be.a.String;
    url.should.equal("https://this-account-has-dashes:bacon@this-account-has-dashes.cloudant.com");
    done();
  });

  it('gets first URL from vcap containing single service', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {url: "http://mykey:mypassword@mydomain.cloudant.com"}}
    ]}};
    var url = reconfigure(config);
    url.should.be.a.String;
    url.should.equal("http://mykey:mypassword@mydomain.cloudant.com");
    done();
  });

  it('gets URL by instance name from vcap containing single service', function(done) {
    var config = {instanceName: "serviceA", vcapServices: {cloudantNoSQLDB: [
      {name: "serviceA", credentials: {url: "http://mykey:mypassword@mydomain.cloudant.com"}}
    ]}};
    var url = reconfigure(config);
    url.should.be.a.String;
    url.should.equal("http://mykey:mypassword@mydomain.cloudant.com");
    done();
  });

  it('gets first URL from vcap containing multiple services', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {url: "http://mykey:mypassword@mydomain.cloudant.com"}},
      {credentials: {url: "http://foo.bar"}},
      {credentials: {url: "http://foo.bar"}}
    ]}};
    var url = reconfigure(config);
    url.should.be.a.String;
    url.should.equal("http://mykey:mypassword@mydomain.cloudant.com");
    done();
  });

  it('gets URL by instance name from vcap containing multiple services', function(done) {
    var config = {instanceName: 'serviceC', vcapServices: {cloudantNoSQLDB: [
      {name: "serviceA", credentials: {url: "http://foo.bar"}},
      {name: "serviceB", credentials: {url: "http://foo.bar"}},
      {name: "serviceC", credentials: {url: "http://mykey:mypassword@mydomain.cloudant.com"}}
    ]}};
    var url = reconfigure(config);
    url.should.be.a.String;
    url.should.equal("http://mykey:mypassword@mydomain.cloudant.com");
    done();
  });

  it('errors for empty vcap', function(done) {
    var config = {vcapServices: {}}
    should(function () { reconfigure(config); }).throw("Missing Cloudant service in vcapServices");
    done();
  });

  it('errors for no services in vcap', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: []}}
    should(function () { reconfigure(config); }).throw("Missing Cloudant service in vcapServices");
    done();
  });

  it('errors for missing service in vcap', function(done) {
    var config = {instanceName: 'serviceC', vcapServices: {cloudantNoSQLDB: [
      {name: "serviceA", credentials: {url: "http://foo.bar"}},
      {name: "serviceB", credentials: {url: "http://foo.bar"}} // missing "serviceC"
    ]}};
    should(function () { reconfigure(config); }).throw("Missing Cloudant service in vcapServices");
    done();
  });

  it('errors for invalid service in vcap - missing credentials', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {name: "serviceA"} // invalid service, missing credentials
    ]}};
    should(function () { reconfigure(config); }).throw('Invalid Cloudant service in vcapServices');
    done();
  });

  it('errors for invalid service in vcap - missing url', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {name: "serviceA", credentials: {}} // invalid service, missing url
    ]}};
    should(function () { reconfigure(config); }).throw("Invalid Cloudant service in vcapServices");
    done();
  });

  it('detects bad urls', function(done) {
    var credentials = { url: 'invalid' };
    var url = reconfigure(credentials);
    assert.equal(url, null);
    var credentials = { url: '' };
    var url = reconfigure(credentials);
    assert.equal(url, null);
    var credentials = { url: 'http://' };
    var url = reconfigure(credentials);
    assert.equal(url, null);
    var credentials = { };
    var url = reconfigure(credentials);
    assert.equal(url, null);
    var credentials = 'invalid';
    var url = reconfigure(credentials);
    assert.equal(url, null);

    done();
  });

});
