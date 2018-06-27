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

/* global describe it */
'use strict';

var should = require('should');
var reconfigure = require('../../lib/reconfigure.js');
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
    var credentials = { account: 'myaccount'};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://myaccount.cloudant.com');
    done();
  });

  it('allows an account and a password to be passed in', function(done) {
    var credentials = { account: 'myaccount', password: 'mypassword'};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://myaccount:mypassword@myaccount.cloudant.com');
    done();
  });

  it('allows a key and an account and a password to be passed in', function(done) {
    var credentials = { account: 'myaccount', password: 'mypassword', key: 'mykey'};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mykey:mypassword@myaccount.cloudant.com');
    done();
  });

  it('allows a username and an account and a password to be passed in', function(done) {
    var credentials = { account: 'myaccount', password: 'mypassword', username: 'myusername'};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://myusername:mypassword@myaccount.cloudant.com');
    done();
  });

  // Issue cloudant/nodejs-cloudant#323
  it('allows a username, a password, and url to be passed in', function(done) {
    var credentials = { username: 'myusername', password: 'mypassword', url: 'http://localhost:8081' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('http://myusername:mypassword@localhost:8081');
    done();
  });

  it('allows a username and password to supersede credentials supplied in a url', function(done) {
    var credentials = { username: 'myusername', password: 'mypassword', url: 'http://user:pass@localhost:8081' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('http://myusername:mypassword@localhost:8081');
    done();
  });

  it('allows a key and an full domain and a password to be passed in', function(done) {
    var credentials = { account: 'myaccount.cloudant.com', password: 'mypassword', key: 'mykey'};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mykey:mypassword@myaccount.cloudant.com');
    done();
  });

  it('allows complex passwords', function(done) {
    var credentials = { account: 'myaccount', password: 'mypassword[]{}!#&='};
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://myaccount:mypassword%5B%5D%7B%7D!%23%26%3D@myaccount.cloudant.com');
    done();
  });

  it('allows a local CouchDB url to used', function(done) {
    var credentials = { url: 'http://localhost:5984' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('http://localhost:5984');
    done();
  });

  it('allows an HTTP Cloudant URL - switching to HTTPS', function(done) {
    var credentials = { url: 'http://mykey:mypassword@mydomain.cloudant.com' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mykey:mypassword@mydomain.cloudant.com');
    done();
  });

  it('allows an HTTP Cloudant URL with a port number - switching to HTTPS', function(done) {
    var credentials = { url: 'http://mykey:mypassword@mydomain.cloudant.com:80' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mykey:mypassword@mydomain.cloudant.com');
    done();
  });

  // Issue cloudant/nodejs-cloudant#129
  it('fixes a Cloudant URL with a trailing / - removing the /', function(done) {
    var credentials = { url: 'https://mykey:mypassword@mydomain.cloudant.com/' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mykey:mypassword@mydomain.cloudant.com');
    done();
  });

  // Issue cloudant/nodejs-cloudant#141
  it('Allows account names with dashes', function(done) {
    var credentials = { account: 'this-account-has-dashes.cloudant.com', password: 'bacon' };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://this-account-has-dashes:bacon@this-account-has-dashes.cloudant.com');
    done();
  });

  it('gets first host from vcap containing single service', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {host: 'mydomain.cloudant.com'}}
    ]}};
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets host by instance name from vcap containing single service', function(done) {
    var config = {instanceName: 'serviceA',
      vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {host: 'mydomain.cloudant.com'}}
      ]}};
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets host by instance name alias from vcap containing single service', function(done) {
    var config = { vcapInstanceName: 'serviceA', // alias of 'instanceName'
      vcapServices: { cloudantNoSQLDB: [
        { name: 'serviceA', credentials: { host: 'mydomain.cloudant.com' } }
      ]}
    };
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets host by service name and instance name from vcap containing single service', function(done) {
    var config = {
      vcapServiceName: 'myNoSQLDB', vcapInstanceName: 'instanceA',
      vcapServices: { myNoSQLDB: [
        { name: 'instanceA', credentials: { host: 'mydomain.cloudant.com' } }
      ]}
    };
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets first host from vcap containing multiple services', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {host: 'mydomain.cloudant.com'}},
      {credentials: {host: 'foo.bar'}},
      {credentials: {host: 'foo.bar'}}
    ]}};
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets host by instance name from vcap containing multiple services', function(done) {
    var config = {instanceName: 'serviceC',
      vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {host: 'foo.bar'}},
      {name: 'serviceB', credentials: {host: 'foo.bar'}},
      {name: 'serviceC', credentials: {host: 'mydomain.cloudant.com'}}
      ]}};
    var outCreds = reconfigure(config);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://mydomain.cloudant.com');
    done();
  });

  it('gets first IAM key from vcap containing single service', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {apikey: '1234api', host: 'user-bluemix.cloudant.com'}}
    ]}};
    var outCreds = reconfigure(config);
    outCreds.iamApiKey.should.be.a.String;
    outCreds.iamApiKey.should.equal('1234api');
    outCreds.outUrl.should.equal('https://user-bluemix.cloudant.com');
    done();
  });

  it('gets first host from vcap containing multiple services', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {credentials: {apikey: 'a1234api', host: 'a-user-bluemix.cloudant.com'}},
      {credentials: {host: 'foo.bar'}},
      {credentials: {host: 'foo.bar'}}
    ]}};
    var outCreds = reconfigure(config);
    outCreds.iamApiKey.should.be.a.String;
    outCreds.iamApiKey.should.equal('a1234api');
    outCreds.outUrl.should.equal('https://a-user-bluemix.cloudant.com');
    done();
  });

  it('gets IAM key by instance name from vcap containing multiple services', function(done) {
    var config = {instanceName: 'serviceB',
      vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {apikey: 'a1234api', host: 'a-user-bluemix.cloudant.com'}},
      {name: 'serviceB', credentials: {apikey: 'b1234api', host: 'b-user-bluemix.cloudant.com'}},
      {name: 'serviceC', credentials: {host: 'mydomain.cloudant.com'}}
      ]}};
    var outCreds = reconfigure(config);
    outCreds.iamApiKey.should.be.a.String;
    outCreds.iamApiKey.should.equal('b1234api');
    outCreds.outUrl.should.equal('https://b-user-bluemix.cloudant.com');
    done();
  });

  // Issue cloudant/nodejs-cloudant#327
  it('allows a vcap_services basic-auth url', function(done) {
    var credentials = { vcapServices: {"cloudantNoSQLDB":[{"credentials":{"username":"x","password":"y","host":"z.cloudant.com","port":443,"url":"https://x:y@z.cloudant.com"},"syslog_drain_url":null,"volume_mounts":[],"label":"cloudantNoSQLDB","provider":null,"plan":"Shared","name":"iot-cloudantNoSQLDB","tags":["data_management","ibm_created","lite","ibm_dedicated_public"]}]} };
    var outCreds = reconfigure(credentials);
    outCreds.outUrl.should.be.a.String;
    outCreds.outUrl.should.equal('https://x:y@z.cloudant.com');
    done();
  });

  it('errors for empty vcap', function(done) {
    var config = {vcapServices: {}};
    should(function() { reconfigure(config); }).throw('Missing Cloudant service in vcapServices');
    done();
  });

  it('errors for no services in vcap', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: []}};
    should(function() { reconfigure(config); }).throw('Missing Cloudant service in vcapServices');
    done();
  });

  it('errors for missing service in vcap', function(done) {
    var config = {instanceName: 'serviceC',
      vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {host: 'foo.bar'}},
      {name: 'serviceB', credentials: {host: 'foo.bar'}} // missing "serviceC"
      ]}};
    should(function() { reconfigure(config); }).throw('Missing Cloudant service in vcapServices');
    done();
  });

  it('errors for invalid service in vcap - missing credentials', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA'} // invalid service, missing credentials
    ]}};
    should(function() { reconfigure(config); }).throw('Invalid Cloudant service in vcapServices');
    done();
  });

  it('errors for invalid service in legacy vcap - missing host', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {}} // invalid service, missing host
    ]}};
    should(function() { reconfigure(config); }).throw('Invalid Cloudant service in vcapServices');
    done();
  });

  it('errors for invalid service in vcap - missing host', function(done) {
    var config = {vcapServices: {cloudantNoSQLDB: [
      {name: 'serviceA', credentials: {apikey: 'a1234api'}} // invalid service, missing host
    ]}};
    should(function() { reconfigure(config); }).throw('Invalid Cloudant service in vcapServices');
    done();
  });

  it('detects bad hosts', function(done) {
    var credentials = { host: 'invalid' };
    var outCreds = reconfigure(credentials);
    assert.equal(outCreds.outUrl, null);
    var credentials = { host: '' };
    var outCreds = reconfigure(credentials);
    assert.equal(outCreds.outUrl, null);
    var credentials = { };
    var outCreds = reconfigure(credentials);
    assert.equal(outCreds.outUrl, null);
    var credentials = 'invalid';
    var outCreds = reconfigure(credentials);
    assert.equal(outCreds.outUrl, null);

    done();
  });
});
