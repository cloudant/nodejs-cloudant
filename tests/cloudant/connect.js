var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  ;

var mock = nock(helpers.cloudant, "cloudant/root");
var Cloudant = require('../..');

specify('cloudant:connect:by_object', timeout, function (assert) {
  var client = Cloudant({account:'nodejs'})
  client.request('', function (er, body) {
    assert.equal(er, undefined, 'Ping Cloudant');
    assert.equal(body.couchdb, 'Welcome', 'Welcome message from Cloudant ping');
    assert.ok(body.version, 'Cloudant version string');
  });
});

specify.run(process.argv.slice(2));
