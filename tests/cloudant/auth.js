var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  , Cloudant = helpers.Cloudant
  ;

var mock = nock(helpers.cloudant_auth, "cloudant/auth");

specify('cloudant:generate_api_key', timeout, function (assert) {
  var client = Cloudant({account:'nodejs'}) // No password

  var pw_error = null
  try        { client.generate_api_key(function() {}) }
  catch (er) { pw_error = er }
  assert.ok(pw_error, 'Throw an error if a password is not provided');

  client = Cloudant({account:'nodejs', password:password()})
  client.generate_api_key(function(er, body) {
    assert.equal(er, undefined, 'Hit the generate_api_key endpoint');
    assert.equal(body.ok, true, 'Good response generating API key');
    assert.ok(body.key        , 'Good API key');
    assert.ok(body.password   , 'Good API password');
  });
});

specify.run(process.argv.slice(2));

function password() {
  var pw = process.env.npm_config_cloudant_password || 'secret';
  return process.env.NOCK ? 'secret' : pw;
}
