var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  ;

var mock = nock(helpers.cloudant_url, "cloudant/connect");
var Cloudant = require('../..');

specify('cloudant:connect:by_object', timeout, function (assert) {
  var client = Cloudant({account:'nodejs'})
  client.request('', function (er, body, headers) {
    assert.equal(er, undefined, 'Ping Cloudant');
    assert.equal(headers['status-code'], 200, 'Cloudant ping status OK');
    assert.equal(body.couchdb, 'Welcome', 'Welcome message from Cloudant ping');
    assert.ok(body.version, 'Cloudant version string');
  });
});

specify('cloudant:connect:with_url', timeout, function (assert) {
  var client = Cloudant({account:'http//nodejs.cloudant.com/'})
  client.request('', function (er, body, headers) {
    assert.equal(er, undefined, 'Ping Cloudant');
    assert.equal(headers['status-code'], 200, 'Cloudant ping status OK');
    assert.equal(body.couchdb, 'Welcome', 'Welcome message from Cloudant ping');
    assert.ok(body.version, 'Cloudant version string');
  });
});

specify('cloudant:connect:authenticated', timeout, function (assert) {
  var client = Cloudant({account:'nodejs', password:helpers.cloudant_pw()})
  client.request('_session', function (er, body, headers) {
    assert.equal(er, undefined, 'Authenticated session check');
    assert.equal(headers['status-code'], 200, 'Cloudant session check status OK');
    assert.ok(body.ok, 'Session check OK');

    var userCtx = body.userCtx || {};
    var name = userCtx.name || '';
    var roles = userCtx.roles || {};
    assert.equal(name, 'nodejs', 'Good authentication as Cloudant user');
    assert.ok(~ roles.indexOf('_admin'), 'Admin role');
    assert.ok(~ roles.indexOf('_reader'), 'Reader role');
    assert.ok(~ roles.indexOf('_writer'), 'Writer role');
  });
});

specify('cloudant:connect:callback', timeout, function (assert) {
  Cloudant({account:'nodejs', password:helpers.cloudant_pw()}, function (er, cloudant, body) {
    assert.equal(er, undefined, 'Auto ping when a connect callback is provided');
    assert.equal(typeof cloudant.relax, 'function', 'Auto ping returns initialized Cloudant client');
    assert.ok(body && body.version, 'Auto ping returns the software version');
    assert.ok(body && body.userCtx, 'Auto ping returns the client user context');
  });
});

specify.run(process.argv.slice(2));
