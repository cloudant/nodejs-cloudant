## Authorization

This feature interfaces with the Cloudant [authorization API][auth].

Use the authorization feature to generate new API keys to access your data. An API key is basically a username/password pair for granting others access to your data, without giving them the keys to the castle.

Generate an API key.

~~~ js
cloudant.generate_api_key(function(er, api) {
  if (er)
    throw er // You probably want wiser behavior than this.

  console.log('API key: %s', api.key)
  console.log('Password for this key: %s', api.password)
~~~

Output:

    API key: isdaingialkyciffestontsk
    Password for this key: XQiDHmwnkUu4tknHIjjs2P64

Next, set access roles for this API key:

~~~ js
  // Set read-only access for this key.
  var db = "my_database"
  cloudant.set_permissions({database:db, username:api.key, roles:['_reader']}, function(er, result) {
    if (er)
      throw er

    console.log('%s now has read-only access to %s', api.key, db)
  })
})
~~~

## Query

This feature interfaces with [Cloudant Query][query].

As with Nano, when working with a database (as opposed to the root server), run the `.use()` method.

~~~ js
var db = cloudant.use('my_db')
~~~

To see all the indexes in a database, call the database `.index()` method with a callback function.

~~~ js
db.index(function(er, result) {
  if (er)
    throw er

  console.log('The database has %d indexes', result.indexes.length)
  for (var i = 0; i < result.indexes.length; i++)
    console.log('  %s (%s): %j', result.indexes[i].name, result.indexes[i].type, result.indexes[i].def)
})
~~~

Example output:

    The database has 3 indexes
      _all_docs (special): {"fields":[{"_id":"asc"}]}
      first-name (json): {"fields":[{"name":"asc"}]}
      last-name (json): {"fields":[{"name":"asc"}]}

To create an index, use the same `.index()` method but with an extra initial argument: the index definition. For example, to make an index on middle names in the data set:

~~~ js
var middle_name = {name:'middle-name', type:'json', index:{fields:['middle']}}
db.index(middle_name, function(er, response) {
  if (er)
    throw er

  console.log('Index creation result: %s', response.result)
})
~~~

Output:

    Index creation result: created

To query using the index, use the `.find()` method.

~~~ js
db.find({selector:{name:'Alice'}}, function(er, result) {
  if (er)
    throw er

  console.log('Found %d documents with name Alice')
  for (var i = 0; i < result.docs.length; i++)
    console.log('  Doc id: %s', result.docs[i]._id)
})
~~~

## Search

This feature interfaces with [Cloudant Search][search].

As with Nano, when working with a database (as opposed to the root server), run the `.use()` method.

~~~ js
var db = cloudant.use('my_db')
~~~

To create a Cloudant Search index, create a design document the normal way you would with Nano, the database `.insert()` method.

To see all the indexes in a database, call the database `.index()` method with a callback function.
             , {_id: '_design/library', indexes:{books:{analyzer:{name:'standard'}, index:index}}}

~~~ js
// Note, you can make a normal JavaScript function. It is not necessary
// for you to convert it to a string as with other languages and tools.
var book_indexer = function(doc) {
  // Index the title and author of books.
  if (doc.type == 'book') {
    index('title', doc.title)
    index('author', doc.author)
  }
}

var ddoc = { _id: '_design/library'
           , indexes:
             { books:
               { analyzer: {name: 'standard'}
               , index   : book_indexer
               }
             }
           }

db.insert(doc, function (er, result) {
  if (er)
    throw er
  else
    console.log('Created design document with books index')
})
~~~

To query this index, use the database `.search()` method. The first argument is the design document name, followed by the index name, and finally an object with your search parameters.

~~~ js
db.search('library', 'books', {q:'author:dickens'}, function(er, result) {
  if (er)
    throw er

  console.log('Showing %d out of a total %d books by Dickens', result.rows.length, result.total_rows)
  for (var i = 0; i < result.rows.length; i++)
    console.log('Document id: %s', result.rows.id)
})
~~~
