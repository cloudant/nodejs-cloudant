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

it('create test data', function(assert) {
  var index = function(doc) {
    index('title', doc.title);
    index('author', doc.author);
  };

  var docs = [
    {_id:'a_tale', title:'A Tale of Two Cities', author:'Charles Dickens'},
    {_id:'towers', title:'The Two Towers'      , author:'J. R. R. Tolkien'},
    { _id: '_design/library',
      indexes: {
        books: {
          analyzer: {
            name:'standard'
          },
          index: index
        }
      }
    }
  ];

  db.bulk({docs:docs}, function(er) {
    assert.equal(er, null, 'Create test data');
    assert.end();
  });
});

it('search test data', function(assert) {
  db.search('library', 'books', {q:'author:charles'}, function(er1, author) {
    db.search('library', 'books', {q:'title:two'}, function(er2, title) {
      assert.equal(er1, null, 'Successful author search');
      assert.equal(er2, null, 'Successful title search');

      assert.equal(author.rows[0].id, 'a_tale', 'Found Charles Dickens book');
      assert.equal(title.total_rows, 2, 'Found both "Two" books');

      assert.end();
    });
  });
});
