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
var harness = helpers.harness(__filename);
var it = harness.it;
var db = harness.locals.db;

var last_index_ddoc;

it('set up Cloudant query', function(assert) {
  // Insert some documents.
  var docs = [
    {name:'Alice'  , last:'Cooper' , score:15},
    {name:'Alice'  , last:'Barnham', score:12},
    {name:'Bob'                    , score:10},
    {name:'Charlie', last:'Sangels', score: 5}
  ];

  var remain = docs.length;
  insert();
  function insert() {
    var doc = docs.shift();
    if (!doc) {
      assert.equal(remain, 0, 'Insert all docs');
      return assert.end();
    }

    db.insert(doc, function (er) {
      if (!er)
        remain -= 1;
      insert();
    });
  }
});

it('create query definition', function(assert) {
  var first = {name:'first-name', type:'json', index:{fields:['name']}};
  var last  = {name:'last-name' , type:'json', index:{fields:['last']}};

  db.index(first, function(er1, body1) {
    db.index(last, function(er2, body2) {
      assert.equal(er1, null, 'Create first-name index');
      assert.equal(er2, null, 'Create last-name index');
      assert.equal(body1.result, 'created', 'first-name index created');
      assert.equal(body2.result, 'created', 'last-name index created');
      assert.end();
    });
  });
});

it('fetch query definition', function(assert) {
  db.index(function(er, body) {
    assert.equal(er, null, 'List indexes works');
    assert.equal(body.indexes.length, 3, 'Two custom indexes + _all_docs');
    assert.equal(body.indexes[0].name, '_all_docs', 'First index is _all_docs');
    assert.equal(body.indexes[1].name, 'first-name',
                 'Second index is by first name');
    assert.equal(body.indexes[2].name, 'last-name',
                 'Third index is by last name');

    // Save the last-name index for deletion later.
    last_index_ddoc = body.indexes[2].ddoc;
    assert.end();
  });
});

it('perform a query', function(assert) {
  db.find({selector:{name:'Alice'}}, function(er1, name) {
    db.find({selector:{last:'Barnham'}}, function(er2, last) {
      assert.equal(er1, null, 'Create first-name index');
      assert.equal(er2, null, 'Create last-name index');

      assert.equal(name.docs.length, 2, 'Found 2 Alice docs');
      assert.equal(last.docs.length, 1, 'Found the Barnham doc');
      assert.end();
    });
  });
});

it('delete a query definition', function(assert) {
  db.index.del({ddoc:last_index_ddoc, name:'last-name'}, function(er, body) {
    assert.equal(er, null, 'Delete last-name index');
    assert.equal(body.ok, true, 'Server delete last-name: ok');
    assert.end();
  });
});
