var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  , Cloudant = helpers.Cloudant
  ;

var auth_mock = nock(helpers.cloudant_auth, "cloudant/auth");
var serv_mock = nock(helpers.cloudant_url , "cloudant/auth_me");

var third_party = {key:null, password:null};

specify('cloudant:generate_api_key', timeout, function (assert) {
  var client = Cloudant({account:'nodejs'}) // No password

  var pw_error = null
  try        { client.generate_api_key(function() {}) }
  catch (er) { pw_error = er }
  assert.ok(pw_error, 'Throw an error if a password is not provided');

  client = Cloudant({account:'nodejs', password:helpers.cloudant_pw()})
  client.generate_api_key(function(er, body) {
    assert.equal(er, undefined, 'Hit the generate_api_key endpoint');
    assert.equal(body.ok, true, 'Good response generating API key');
    assert.ok(body.key        , 'Good API key');
    assert.ok(body.password   , 'Good API password');

    // Store this for later, to grant permissions to this third party.
    third_party.key = body.key;
    third_party.password = body.password;
  });
});

specify('cloudant:third_party_access', timeout, function (assert) {
  Cloudant({account:'nodejs', key:third_party.key, password:third_party.password}, function(er, cloudant, body) {
    assert.equal(er, undefined, 'Connect and authenticate using the new API key');
    assert.ok(body && body.userCtx, 'Third-party connect got a good pong');
    assert.equal(body.userCtx.name, third_party.key, 'Third-party correctly identified by Cloudant server');
  })
});

specify('cloudant:set_permissions', timeout, function (assert) {
  var client = Cloudant({account:'nodejs'}) // No password

  var pw_error = null
  try        { client.set_permissions({}, function() {}) }
  catch (er) { pw_error = er }
  assert.ok(pw_error, 'Throw an error if a password is not provided');

  var opts = {database:'third_party_db', username:third_party.key, roles:['_reader','_writer']};
  client = Cloudant({account:'nodejs', password:helpers.cloudant_pw()})
  client.set_permissions(opts, function(er, body) {
    assert.equal(er, undefined, 'Hit the generate_api_key endpoint');
    assert.equal(body.ok, true, 'Good response setting permissions');
  });
});

specify.run(process.argv.slice(2));
