var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  , cloudant = helpers.cloudant
  ;

var mock = nock(helpers.cloudant_url, "cloudant/query");

var db;

specify("cloudant:query:setup", timeout, function (assert) {
  cloudant.db.create('query_db', function(er) {
    if (er)
      throw er;
    db = cloudant.use('query_db');

    // Insert some documents.
    var docs = [ {name:'Alice'  , last:'Cooper' , score:15}
               , {name:'Alice'  , last:'Barnham', score:12}
               , {name:'Bob'                    , score:10}
               , {name:'Charlie', last:'Sangels', score: 5}];

    var remain = docs.length;
    insert();
    function insert() {
      var doc = docs.shift();
      if (!doc)
        return assert.equal(remain, 0, 'Insert all docs');

      db.insert(doc, function (er, body) {
        if (!er)
          remain -= 1;
        insert();
      });
    }
  });
});

specify('cloudant:query:get', timeout, function(assert) {
  db.index.list(function(er, body) {
    assert.equal(er, undefined, 'List indexes works');

    var all_docs = body.indexes && body.indexes[0];
    assert.ok(all_docs, 'One index is visible');
    assert.equal(all_docs.name, '_all_docs', 'First index is _all_docs');
  });
});

specify("cloudant:query:teardown", timeout, function (assert) {
  cloudant.db.destroy('query_db', function(er) {
    assert.equal(er, undefined, "Failed to create database");
  });
});

specify.run(process.argv.slice(2));
