var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  , cloudant = helpers.cloudant
  ;

var mock = nock(helpers.cloudant_url, "cloudant/search");


specify("cloudant:search:setup", timeout, function (assert) {
  cloudant.db.create('search_db', function(er) {
    assert.equal(er, undefined, 'Set up query DB');
  });
});

specify('cloudant:search:data', timeout, function(assert) {
  var db = cloudant.use('search_db');
  var index = function(doc) { index('title', doc.title); index('author', doc.author) };
  var docs = [ {_id:'a_tale', title:'A Tale of Two Cities', author:'Charles Dickens'}
             , {_id:'towers', title:'The Two Towers'      , author:'J. R. R. Tolkien'}
             , {_id: '_design/library', indexes:{books:{analyzer:{name:'standard'}, index:index}}}
             ]

  db.bulk({docs:docs}, function(er, body) {
    assert.equal(er, undefined, 'Create test data');
  });
});

specify('cloudant:search:query', timeout, function(assert) {
  var db = cloudant.use('search_db');
  db.search('library', 'books', {q:'author:charles'}, function(er1, author) {
    db.search('library', 'books', {q:'title:two'}, function(er2, title) {
      assert.equal(er1, undefined, 'Successful author search');
      assert.equal(er2, undefined, 'Successful title search');

      assert.equal(author.rows[0].id, 'a_tale', 'Found Charles Dickens book');
      assert.equal(title.total_rows, 2, 'Found both "Two" books');
    });
  });
});

specify("cloudant:search:teardown", timeout, function (assert) {
  cloudant.db.destroy('search_db', function(er) {
    assert.equal(er, undefined, 'Delete search database');
  });
});

specify.run(process.argv.slice(2));
