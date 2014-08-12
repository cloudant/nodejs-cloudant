var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nock     = helpers.nock
  , cloudant = helpers.cloudant
  ;

var mock = nock(helpers.cloudant_url, "cloudant/query");

var db;
var last_index_ddoc;

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

specify('cloudant:query:create', timeout, function(assert) {
  var first = {name:'first-name', type:'json', index:{fields:['name']}}
  var last  = {name:'last-name' , type:'json', index:{fields:['last']}}

  db.index(first, function(er1, body1) {
    db.index(last, function(er2, body2,H) {
      assert.equal(er1, undefined, 'Create first-name index');
      assert.equal(er2, undefined, 'Create last-name index');
      assert.equal(body1.result, 'created', 'first-name index created');
      assert.equal(body2.result, 'created', 'last-name index created');
    });
  });
});

specify('cloudant:query:get', timeout, function(assert) {
  db.index(function(er, body) {
    assert.equal(er, undefined, 'List indexes works');
    assert.equal(body.indexes.length, 3, 'Two custom indexes + _all_docs');
    assert.equal(body.indexes[0].name, '_all_docs', 'First index is _all_docs');
    assert.equal(body.indexes[1].name, 'first-name', 'Second index is by first name');
    assert.equal(body.indexes[2].name, 'last-name', 'Third index is by last name');

    // Save the last-name index for deletion later.
    last_index_ddoc = body.indexes[2].ddoc
  });
});

specify('cloudant:query:find', timeout, function(assert) {
  db.find({selector:{name:'Alice'}}, function(er1, name) {
    db.find({selector:{last:'Barnham'}}, function(er2, last) {
      assert.equal(er1, undefined, 'Create first-name index');
      assert.equal(er2, undefined, 'Create last-name index');

      assert.equal(name.docs.length, 2, 'Found 2 Alice docs');
      assert.equal(last.docs.length, 1, 'Found the Barnham doc');
    });
  });
});

specify('cloudant:query:delete', timeout, function(assert) {
  db.index.del({ddoc:last_index_ddoc, name:'last-name'}, function(er, body) {
    assert.equal(er, undefined, 'Delete last-name index');
    assert.equal(body.ok, true, 'Server delete last-name: ok');
  });
});

specify("cloudant:query:teardown", timeout, function (assert) {
  cloudant.db.destroy('query_db', function(er) {
    assert.equal(er, undefined, "Failed to create database");
  });
});

specify.run(process.argv.slice(2));
