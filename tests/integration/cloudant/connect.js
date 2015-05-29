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

'use strict';

var helpers = require('../../helpers/integration');
var harness = helpers.harness(__filename, helpers.noopTest, helpers.noopTest);
var it = harness.it;
var Cloudant = helpers.Cloudant;

it('pings the server', function(assert) {
  var client = Cloudant({account:'nodejs'});
  client.request('', function (er, body, headers) {
    assert.equal(er, null, 'Ping Cloudant');
    assert.equal(headers.statusCode, 200, 'Cloudant ping status OK');
    assert.equal(body.couchdb, 'Welcome', 'Welcome message from Cloudant ping');
    assert.ok(body.version, 'Cloudant version string');
    assert.end();
  });
});

it('connects with a URL', function(assert) {
  var client = Cloudant({account:'http//nodejs.cloudant.com/'});
  client.request('', function (er, body, headers) {
    assert.equal(er, null, 'Ping Cloudant');
    assert.equal(headers.statusCode, 200, 'Cloudant ping status OK');
    assert.equal(body.couchdb, 'Welcome', 'Welcome message from Cloudant ping');
    assert.ok(body.version, 'Cloudant version string');
    assert.end();
  });
});

it('connects with authentication', function(assert) {
  var client = Cloudant({account:'nodejs', password:helpers.cloudant_pw()});
  client.request('_session', function (er, body, headers) {
    assert.equal(er, null, 'Authenticated session check');
    assert.equal(headers.statusCode, 200, 'Cloudant session check status OK');
    assert.ok(body.ok, 'Session check OK');

    var userCtx = body.userCtx || {};
    var name = userCtx.name || '';
    var roles = userCtx.roles || {};
    assert.equal(name, 'nodejs', 'Good authentication as Cloudant user');
    assert.ok(~ roles.indexOf('_admin'), 'Admin role');
    assert.ok(~ roles.indexOf('_reader'), 'Reader role');
    assert.ok(~ roles.indexOf('_writer'), 'Writer role');
    assert.end();
  });
});

it('supports a ping callback', function(assert) {
  Cloudant({account:'nodejs', password:helpers.cloudant_pw()}, connected);

  function connected(er, cloudant, body) {
    assert.equal(er, null, 'Auto ping when a connect callback is provided');
    assert.equal(typeof cloudant.relax, 'function',
                 'Auto ping returns initialized Cloudant client');
    assert.ok(body && body.version,'Auto ping returns the software version');
    assert.ok(body && body.userCtx,'Auto ping returns the client user context');
    assert.end();
  }
});
