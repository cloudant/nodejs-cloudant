# Cloudant Node.js Client

This is the official Cloudant library for Node.js.

* [Installation and Usage](#installation-and-usage)
* [Getting Started](#getting-started)
* [API Reference](#api-reference)
* [Development](#development)
  * [Test Suite](#test-suite)
  * [Using in Other Projects](#using-in-other-projects)
  * [License](#license)

## Installation and Usage

The best way to use the Cloudant client is to begin with your own Node.js project, and define this work as your dependency. In other words, put me in your package.json dependencies. The `npm` tool can do this for you, from the command line:

    $ npm install --save cloudant

Notice that your package.json will now reflect this package. Everyting is working if you can run this command with no errors:

    $ node -e 'require("cloudant"); console.log("Cloudant works");'
    Cloudant works

### Getting Started

Now it's time to begin doing real work with Cloudant and Node.js.

Initialize your Cloudant connection by supplying your *account* and *password*, and supplying a callback function to run when eveything is ready.

~~~ js
var Cloudant = require('cloudant')

var me = 'jhs' // Set this to your own account
var password = process.env.cloudant_password

Cloudant({account:me, password:password}, function(er, cloudant) {
  if (er)
    return console.log('Error connecting to Cloudant account %s: %s', me, er.message)

  console.log('Connected to cloudant')
  cloudant.ping(function(er, reply) {
    if (er)
      return console.log('Failed to ping Cloudant. Did the network just go down?')

    console.log('Server version = %s', reply.version)
    console.log('I am %s and my roles are %j', reply.userCtx.name, reply.userCtx.roles)

    cloudant.db.list(function(er, all_dbs) {
      if (er)
        return console.log('Error listing databases: %s', er.message)

      console.log('All my databases: %s', all_dbs.join(', '))
    })
  })
})
~~~

Output:

    Connected to cloudant
    Server version = 1.0.2
    I am jhs and my roles are ["_admin","_reader","_writer"]
    All my databases: example_db, jasons_stuff, scores

Upper-case `Cloudant` is this package you load using `require()`, while lower-case `cloudant` represents an authenticated, confirmed connection to your Cloudant service.

If you omit the "password" field, you will get an "anonymous" connection: a client that sends no authentication information (no passwords, no cookies, etc.)

The `.ping()` call is for clarity. In fact, when you initialize your conneciton, you implicitly ping Cloudant, and the "pong" value is passed to you as an optional extra argument: `Cloudant({account:"A", password:"P"}, function(er, cloudant, pong_reply) { ... })`

To use this code as-is, you must first type ` export cloudant_password="<whatever>"` in your shell. This is inconvenient, and you can invent your own alternative technique.

### Security Note

**DO NOT hard-code your password and commit it to Git**. Storing your password directly in your source code (even in old commits) is a serious security risk to your data. Whoever gains access to your software will now also have access read, write, and delete permission to your data. Think about GitHub security bugs, or contractors, or disgruntled employees, or lost laptops at a conference. If you check in your password, all of these situations become major liabilities. (Also, note that if you follow these instructions, the `export` command with your password will likely be in your `.bash_history` now, which is kind of bad. However, if you input a space before typing the command, it will not be stored in your history.)

Here is simple but complete example of working with data:

~~~ js
var Cloudant = require('Cloudant')

var me = 'jhs' // Set this to your own account
var password = process.env.cloudant_password

Cloudant({account:"me", password:password}, function(er, cloudant) {
  if (er)
    return console.log('Error connecting to Cloudant account %s: %s', me, er.message)

  // Clean up the database we created previously.
  cloudant.db.destroy('alice', function() {
    // Create a new database.
    cloudant.db.create('alice', function() {
      // specify the database we are going to use
      var alice = Cloudant.use('alice')
      // and insert a document in it
      alice.insert({ crazy: true }, 'rabbit', function(err, body, header) {
        if (err)
          return console.log('[alice.insert] ', err.message)

        console.log('you have inserted the rabbit.')
        console.log(body)
      })
    })
  })
})
~~~

If you run this example, you will see:

    you have inserted the rabbit.
    { ok: true,
      id: 'rabbit',
      rev: '1-6e4cb465d49c0368ac3946506d26335d' }

## API Reference

- [Initialization](#initialization)
- [Callback Signature](#callback-signature)
- [Authorization and API Keys](#authorization-and-api-keys)
- [Database Functions](#database-functions)
	- [cloudant.db.create(name, [callback])](#Cloudantdbcreatename-callback)
	- [cloudant.db.get(name, [callback])](#Cloudantdbgetname-callback)
	- [cloudant.db.destroy(name, [callback])](#Cloudantdbdestroyname-callback)
	- [cloudant.db.list([callback])](#Cloudantdblistcallback)
	- [cloudant.db.replicate(source, target, [opts], [callback])](#Cloudantdbreplicatesource-target-opts-callback)
	- [cloudant.db.changes(name, [params], [callback])](#Cloudantdbchangesname-params-callback)
	- [cloudant.db.follow(name, [params], [callback])](#Cloudantdbfollowname-params-callback)
	- [Cloudant.use(name)](#Cloudantusename)
	- [Cloudant.request(opts, [callback])](#Cloudantrequestopts-callback)
	- [Cloudant.config](#Cloudantconfig)
	- [Cloudant.updates([params], [callback])](#Cloudantupdatesparams-callback)
	- [Cloudant.follow_updates([params], [callback])](#Cloudantfollow_updatesparams-callback)
- [Document Functions](#document-functions)
	- [db.insert(doc, [params], [callback])](#dbinsertdoc-params-callback)
	- [db.destroy(doc_id, rev, [callback])](#dbdestroydoc_id-rev-callback)
	- [db.get(doc_id, [params], [callback])](#dbgetdoc_id-params-callback)
	- [db.head(doc_id, [callback])](#dbheaddoc_id-callback)
	- [db.copy(src_doc, dest_doc, opts, [callback])](#dbcopysrc_doc-dest_doc-opts-callback)
	- [db.bulk(docs, [params], [callback])](#dbbulkdocs-params-callback)
	- [db.list([params], [callback])](#dblistparams-callback)
	- [db.fetch(doc_ids, [params], [callback])](#dbfetchdoc_ids-params-callback)
  - [db.fetch_revs(doc_ids, [params], [callback])](#dbfetch_revsdoc_ids-params-callback)
- [Multipart Functions](#multipart-functions)
	- [db.multipart.insert(doc, attachments, [params], [callback])](#dbmultipartinsertdoc-attachments-params-callback)
	- [db.multipart.get(doc_id, [params], [callback])](#dbmultipartgetdoc_id-params-callback)
- [Attachment Functions](#attachments-functions)
	- [db.attachment.insert(doc_id, attname, att, contenttype, [params], [callback])](#dbattachmentinsertdoc_id-attname-att-contenttype-params-callback)
	- [db.attachment.get(doc_id, attname, [params], [callback])](#dbattachmentgetdoc_id-attname-params-callback)
	- [db.attachment.destroy(doc_id, attname, rev, [callback])](#dbattachmentdestroydoc_id-attname-rev-callback)
- [Design Document Functions](#design-document-functions)
	- [db.view(designname, viewname, [params], [callback])](#dbviewdesignname-viewname-params-callback)
	- [db.show(designname, showname, doc_id, [params], [callback])](#dbshowdesignname-showname-doc_id-params-callback)
	- [db.atomic(designname, updatename, doc_id, [body], [callback])](#dbatomicdesignname-updatename-doc_id-body-callback)
	- [db.search(designname, viewname, [params], [callback])](#dbsearchdesignname-searchname-params-callback)
- [Cloudant Search](#cloudant-search)
- [Cloudant Query](#cloudant-query)
- [Cookie Authentication](#cookie-authentication)
- [Advanced Configuration](#advanced-configuration)
- [Advanced Features](#advanced-features)
	- [Extending the Cloudant Library](#extending-the-cloudant-library)
	- [Pipes](#pipes)
- [tests](#tests)

### Initialization

To use Cloudant, `require('cloudant')` in your code. That will return the initialization function. Run that function, passing your account name and password, and a callback. (And see the [security note](#security-note) about placing your password into your source code.

~~~ js
var Cloudant = require('cloudant')

// Connect to Cloudant.
Cloudant({account:me, password:password}, function(er, cloudant) {
  if (er)
    return console.log('Error connecting to Cloudant account %s: %s', me, er.message)

  console.log('Connected to cloudant')

  /*
   * The rest of my code goes here.
   */
})
~~~

### cloudant.ping([callback])

Ping Cloudant. If this succeeds, then you have a good connection to Cloudant, and if you provided authentication credentials, they are valid.

~~~ js
cloudant.ping(function(er, reply) {
  if (er)
    return console.log('Failed to ping Cloudant')

  console.log('Server version = %s', reply.version)
  console.log('I am %s and my roles are %j', reply.userCtx.name, reply.userCtx.roles)
})
~~~

### Callback Signature

After initialization, in general, callback functions receive three arguments:

* `err` - the error, if any
* `body` - the http _response body_ from Cloudant, if no error.
  json parsed body, binary for non json responses
* `header` - the http _response header_ from Cloudant, if no error

The `ping()` function is the only exception to this rule. It does not return headers since a "ping" is made from multiple requests to gather various bits of information.

## Authorization and API Keys

This feature interfaces with the Cloudant [authorization API][auth].

Use the authorization feature to generate new API keys to access your data. An API key is basically a username/password pair for granting others access to your data, without giving them the keys to the castle.

### Generate an API key

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

### Use an API Key

To use an API key, initialize a new Cloudant connection, and provide an additional "key" option when you initialize Cloudant. This will connect to your account, but using the "key" as the authenticated user. (And of course, use the appropriate password associated with the API key.)

~~~ js
Cloudant({account:"me", key:api.key, password:api.password}, function(er, cloudant, reply) {
  if (er)
    throw er

  console.log('Connected with API key %s', reply.userCtx.name)
})
~~~

## Database Functions

Once Cloudant is initialized without errors, your callback has a `cloudant` object representing your connection to the server. To work with databases, use these database functions. (To work with data *inside* the databases, see below.)

### cloudant.db.create(name, [callback])

Create a Cloudant database with the given `name`.

~~~ js
cloudant.db.create('alice', function(err, body) {
  if (!err)
    console.log('database alice created!')
})
~~~

### cloudant.db.get(name, [callback])

Get information about `name`.

~~~ js
cloudant.db.get('alice', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### cloudant.db.destroy(name, [callback])

Destroy database named `name`.

~~~ js
cloudant.db.destroy('alice', function(err) {
  if (!err)
    console.log('Destroyed database alice')
})
~~~

### cloudant.db.list([callback])

List all the databases in Cloudant server.

~~~ js
cloudant.db.list(function(err, body) {
  // body is an array
  body.forEach(function(db) {
    console.log(db)
  })
})
~~~

### cloudant.db.replicate(source, target, [opts], [callback])

Replicates `source` to `target` with options `opts`. `target`
must exist, add `create_target:true` to `opts` to create it prior to
replication.

~~~ js
cloudant.db.replicate('alice', 'http://admin:password@otherhost.com:5984/alice',
                  { create_target:true }, function(err, body) {
    if (!err)
      console.log(body)
})
~~~

### cloudant.db.changes(name, [params], [callback])

Asks for the changes feed of `name`, `params` contains additions
to the query string.

~~~ js
cloudant.db.changes('alice', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### cloudant.db.follow(name, [params], [callback])

Use [Follow][follow] to create a solid changes feed. Please consult the Follow documentation for more information as this is a very complete api on it's own.

~~~ js
var feed = db.follow({since: "now"})
feed.on('change', function (change) {
  console.log("change: ", change);
})
feed.follow();
process.nextTick(function () {
  db.insert({"bar": "baz"}, "bar");
});
~~~

### cloudant.db.use(name)

Create a new database object for operating within the scope of a specific database.

~~~ js
var alice = cloudant.db.use('alice')
alice.insert({ crazy: true }, 'rabbit', function(err, body) {
  // do something
})
~~~

### cloudant.request(opts, [callback])

Make a custom request to Cloudant, the available `opts` are:

* `opts.db` – the database name
* `opts.method` – the http method, defaults to `get`
* `opts.path` – the full path of the request, overrides `opts.doc` and
  `opts.att`
* `opts.doc` – the document name
* `opts.att` – the attachment name
* `opts.params` – query string parameters, appended after any existing `opts.path`, `opts.doc`, or `opts.att`
* `opts.content_type` – the content type of the request, default to `json`
* `opts.headers` – additional http headers, overrides existing ones
* `opts.body` – the document or attachment body
* `opts.encoding` – the encoding for attachments
* `opts.multipart` – array of objects for multipart request

### cloudant.config

An object containing the Cloudant configurations, possible keys are:

* `url` - the Cloudant url
* `db` - the database name

### cloudant.updates([params], [callback])

Listen to db updates, the available `params` are:

* `params.feed` – Type of feed. Can be one of
 * `longpoll`: Closes the connection after the first event.
 * `continuous`: Send a line of JSON per event. Keeps the socket open until timeout.
 * `eventsource`: Like, continuous, but sends the events in EventSource format.
* `params.timeout` – Number of seconds until CouchDB closes the connection. Default is 60.
* `params.heartbeat` – Whether CouchDB will send a newline character (\n) on timeout. Default is true.

### Cloudant.follow_updates([params], [callback])

Uses [follow](https://github.com/iriscouch/follow) to create a solid
[`_db_updates`](http://docs.couchdb.org/en/latest/api/server/common.html?highlight=db_updates#get--_db_updates) feed.
please consult follow documentation for more information as this is a very complete api on it's own

~~~js
var feed = Cloudant.follow_updates({since: "now"})
feed.on('change', function (change) {
  console.log("change: ", change)
})
feed.follow()
process.nextTick(function () {
  cloudant.db.create('alice')
})
~~~

## Document functions

Once you run [cloudant.db.use('db_name')](#cloudant-db-use-db-name), use the returned object to work with documents in the database.

### db.insert(doc, doc_id, [callback])

Insert `doc` in the database. The first parameter (an object) is the document body. The second parameter is the document ID.

~~~ js
var alice = cloudant.use('alice')
alice.insert({ crazy: true }, 'rabbit', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### db.get(doc_id, [params], [callback])

Get `doc_id` from the database with optional query string additions `params`.

~~~ js
alice.get('rabbit', { revs_info: true }, function(err, body) {
  if (!err)
    console.log(body);
});
~~~

### db.destroy(doc_id, rev, [callback])

Remove revision `rev` of `doc_id` from the Cloudant database.

~~~ js
alice.destroy('rabbit', '3-66c01cdf99e84c83a9b3fe65b88db8c0', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### db.head(doc_id, [callback])

Same as `get` but lightweight version that returns headers only.

~~~ js
alice.head('rabbit', function(err, _body, headers) {
  // In fact, _body is empty.

  if (!err)
    console.log(headers)
})
~~~

### db.copy(src_doc, dest_doc, opts, [callback])

`copy` the contents (and attachments) of a document
to a new document, or overwrite an existing target document

~~~ js
alice.copy('rabbit', 'rabbit2', { overwrite: true }, function(err, _, headers) {
  if (!err)
    console.log(headers)
})
~~~


### db.bulk(docs, [params], [callback])

Bulk operations(update/delete/insert) on the database, refer to the
[Documentation](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API).

### db.list([params], [callback])

List all the docs in the database with optional query string additions `params`.

~~~ js
alice.list(function(err, body) {
  if (!err) {
    body.rows.forEach(function(doc) {
      console.log(doc)
    })
  }
})
~~~

### db.fetch(doc_ids, [params], [callback])

Bulk fetch of the database documents, `doc_ids` are specified as per
[CouchDB doc](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API).
Additional query string `params` can be specified, `include_docs` is always set
to `true`.

### db.fetch_revs(doc_ids, [params], [callback])

Bulk fetch of the revisions of the database documents, `doc_ids` are specified as per
[CouchDB doc](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API).
Additional query string `params` can be specified, this is the same method as fetch but
 `include_docs` is not automatically set to `true`.

## Multipart Functions

The multipart functions are for efficiently working with documents and attachments, by using a special feature of HTTP: the "multipart/related" content type. Requests that use multipart/related separate the content into different pieces, with each piece encoded in a different way. In practice, this means sending a JSON document plus binary attachments to Cloudant in a single, efficient, request.

### db.multipart.insert(doc, attachments, doc_id, [callback])

Insert a `doc` together with `attachments` and optional `params`.  Refer to the [CouchDB multipart documentation](http://wiki.apache.org/couchdb/HTTP_Document_API#Multiple_Attachments) for more details.

`attachments` must be an array of objects with `name`, `data` and `content_type` properties. For example:

~~~ js
var fs = require('fs')

fs.readFile('rabbit.png', function(err, data) {
  if (!err) {
    var img = {name:'rabbit.png', content_type:'image/png', data:data}
    var attachments = [img] // An array with one attachment, the rabbit image
    alice.multipart.insert({ ears: 2 }, attachments, 'rabbit', function(err, body) {
      if (!err)
        console.log(body)
    })
  }
})
~~~

### db.multipart.get(doc_id, [params], [callback])

Get `doc_id` together with its attachments via `multipart/related` request with optional query string additions
`params`. Refer to the [doc](http://wiki.apache.org/Cloudant/HTTP_Document_API#Getting_Attachments_With_a_Document) for more details. The multipart response body is a `Buffer`.

~~~ js
alice.multipart.get('rabbit', function(err, buffer) {
  if (!err)
    console.log(buffer.toString())
})
~~~

## Attachment Functions

### db.attachment.insert(doc_id, attname, att, contenttype, [params], [callback])

Inserts an attachment `attname` to `doc_id`. In most cases `params.rev` is required. Refer to the [doc](http://wiki.apache.org/Cloudant/HTTP_Document_API) for more details.

~~~ js
var fs = require('fs')

fs.readFile('rabbit.png', function(err, data) {
  if (!err) {
    alice.attachment.insert('rabbit', 'rabbit.png', data, 'image/png',
      { rev: '12-150985a725ec88be471921a54ce91452' }, function(err, body) {
        if (!err)
          console.log(body)
    })
  }
})
~~~

If you use `null` as the data parameter, then this function returns a writable stream, to which you can pipe the attachment data.

~~~ js
var fs = require('fs')

var img_stream = fs.createReadStream('rabbit.png')
var attachment = alice.attachment.insert('new', 'rabbit.png', null, 'image/png')

img_stream.pipe(attachment)
~~~

### db.attachment.get(doc_id, attname, [params], [callback])

Get `doc_id`'s attachment `attname` with optional query string additions `params`.

~~~ js
var fs = require('fs')

alice.attachment.get('rabbit', 'rabbit.png', function(err, body) {
  if (!err)
    fs.writeFile('rabbit.png', body)
})
~~~

This function also returns a readable stream, which you may pipe to a writable stream.
Or using `pipe`:

~~~ js
var fs = require('fs')

var img_stream = fs.createWriteStream('rabbit.png')
var attachment = alice.attachment.get('rabbit', 'rabbit.png')

attachment.pipe(img_stream)
~~~

### db.attachment.destroy(doc_id, attname, rev, [callback])

Destroy attachment `attname` of `doc_id`'s revision `rev`.

~~~ js
var rev = '1-4701d73a08ce5c2f2983bf7c9ffd3320'
alice.attachment.destroy('rabbit', 'rabbit.png', rev, function(err, body) {
  if (!err)
    console.log(body)
})
~~~

## Design Document Functions

These functions are for working with views and design documents, including querying the database using map-reduce views, [Cloudant Search](#cloudant-search), and [Cloudant Query](#cloudant-query).

### db.view(designname, viewname, [params], [callback])

Call a view of the specified design with optional query string additions
`params`. If you're looking to filter the view results by key(s) pass an array of keys, e.g
`{ keys: ['key1', 'key2', 'key_n'] }`, as `params`.

~~~ js
alice.view('characters', 'crazy_ones', function(err, body) {
  if (!err)
    body.rows.forEach(function(doc) {
      console.log(doc.value)
    })
})
~~~

### db.view_with_list(designname, viewname, listname, [params], [callback])

Call a list function feeded by the given view of the specified design document.

~~~ js
alice.view_with_list('characters', 'crazy_ones', 'my_list', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### db.show(designname, showname, doc_id, [params], [callback])

Call a show function of the specified design for the document specified by doc_id with
optional query string additions `params`.

~~~ js
alice.show('characters', 'format_doc', '3621898430', function(err, doc) {
  if (!err)
    console.log(doc)
})
~~~

Take a look at the [CouchDB wiki](http://wiki.apache.org/couchdb/Formatting_with_Show_and_List#Showing_Documents) for possible query paramaters and more information on show functions.

### db.atomic(designname, updatename, doc_id, [body], [callback])

Call the design's update function with the specified doc in input.

~~~ js
db.atomic("update", "inplace", "foobar", {field: "foo", value: "bar"}, function (error, response) {
  assert.equal(error, undefined, "failed to update")
  assert.equal(response.foo, "bar", "update worked")
})
~~~

Note that the data is sent in the body of the request.  An example update handler follows:

~~~ js
"updates": {
  "in-place" : "function(doc, req) {
      var field = req.form.field;
      var value = req.form.value;
      var message = 'set '+field+' to '+value;
      doc[field] = value;
      return [doc, message];
  }"
~~~

### db.search(designname, searchname, [params], [callback])

Call a view of the specified design with optional query string additions `params`. See the [Cloudant Search](#cloudant-search) section below for more details.

~~~ js
alice.search('characters', 'crazy_ones', { q: 'cat' }, function(err, doc) {
  if (!err) {
    console.log(doc);
  }
});
~~~

## Cloudant Query

This feature interfaces with Cloudant's query functionality. See the [Cloudant Query documentation][query] for details.

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


## Cloudant Search

This feature interfaces with Cloudant's search functionality. See the [Cloudant Search documentation][search] for details.

First, when working with a database (as opposed to the root server), run the `.use()` method.

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

## Cookie Authentication

Cloudant supports making requests using Cloudant's [cookie authentication](http://guide.couchdb.org/editions/1/en/security.html#cookies) functionality. there's a [step-by-step guide here](http://codetwizzle.com/articles/couchdb-cookie-authentication-nodejs-couchdb/), but essentially you just:

~~~ js
var Cloudant     = require('Cloudant')
var username = 'user'
var userpass = 'pass'

// A global variable to store the cookies. This can be on the filesystem or some other cache, too.
var cookies = {}

Cloudant({account:username, password:userpass}, function(err, cloudant) {
  if (err)
    return console.log('Failed to connect to Cloudant: ' + err.message)

  // In this example, we authenticate using the same username/userpass as above.
  // However, you can use a different combination to authenticate as other users
  // in your database. This can be useful for using a less-privileged account.
  cloudant.auth(username, userpass, function(err, body, headers) {
    if (err)
      return console.log('Error authenticating: ' + err.message)

    console.log('Got cookie for %s: %s', username, headers['set-cookie'])

    // Store the authentication cookie for later.
    cookies[username] = headers['set-cookie']
  })
})
~~~

To reuse a cookie:

~~~ js
// Make a new connection with the cookie.
Cloudant({account:username, cookie:cookies[username]}, function(err, other_cloudant) {
  if (err)
    return console.log('Failed to connect to Cloudant: ' + err.message)

  console.log('Connected to Cloudant using a cookie!')

  var alice = other_cloudant.use('alice')
  alice.insert({_id:"my_doc"}, function (err, body, headers) {
    if (err)
      return console.log('Failed to insert into alice database: ' + err.message)

    // Change the cookie if Cloudant tells us to.
    if (headers && headers['set-cookie'])
      cookies[username] = headers['set-cookie']
  })
})
~~~

Getting current session:

~~~javascript
var Cloudant = require('Cloudant')({url: 'http://localhost:5984', cookie: 'AuthSession=' + auth});

Cloudant.session(function(err, session) {
  if (err) {
    return console.log('oh noes!')
  }

  console.log('user is %s and has these roles: %j',
    session.userCtx.user, session.userCtx.roles);
});
~~~

### Advanced Configuration

Besides the account and password options, you can add an optionsl `request_defaults` value, which will initialize Request (the underlying HTTP library) as you need it.

~~~ js
var Cloudant = require('Cloudant')

// Use an HTTP proxy to connect to Cloudant.
var options =
  { "account"         : "my_account"
  , "password"        : "secret"
  , "request_defaults": { "proxy": "http://localhost:8080" }
  }

Cloudant(options, function(err, cloudant) {
  // Now using the HTTP proxy...
})
~~~

Please check [request] for more information on the defaults. They support features like cookie jar, proxies, ssl, etc.

### Pool size and open sockets

A very important configuration parameter if you have a high traffic website and are using Cloudant is setting up the `pool.size`. By default, the node.js https global agent (client) has a certain size of active connections that can run simultaneously, while others are kept in a queue. Pooling can be disabled by setting the `agent` property in `request_defaults` to false, or adjust the global pool size using:

~~~ js
var https = require('https')
https.globalAgent.maxSockets = 20
~~~

You can also increase the size in your calling context using `request_defaults` if this is problematic. refer to the [request] documentation and examples for further clarification.

Here is an example of explicitly using the keep alive agent (installed using `npm install agentkeepalive`), especially useful to limit your open sockets when doing high-volume access to Cloudant:

~~~ js
var agentkeepalive = require('agentkeepalive')
var myagent = new agentkeepalive({
    maxSockets: 50
  , maxKeepAliveRequests: 0
  , maxKeepAliveTime: 30000
  })

var Cloudant = require('cloudant')
Cloudant({account:"me", password:"secret", request_defaults:{agent:myagent}}, function(err, cloudant) {
  // Using Cloudant with myagent...
})
~~~

## Advanced Features

### Extending the Cloudant Library

Cloudant is minimalistic but you can add your own features with `cloudant.request(opts, callback)`

For example, to create a function to retrieve a specific revision of the `rabbit` document:

~~~ js
function getrabbitrev(rev, callback) {
  cloudant.request({ db: 'alice',
                     doc: 'rabbit',
                     method: 'get',
                     params: { rev: rev }
                   }, callback)
}

getrabbitrev('4-2e6cdc4c7e26b745c2881a24e0eeece2', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### Pipes

You can pipe in Cloudant like in any other stream.  for example if our `rabbit` document has an attachment with name `picture.png` (with a picture of our white rabbit, of course!) you can pipe it to a `writable
stream`

See the [Attachment Functions](#attachment-functions) section for examples of piping to and from attachments.

## tests

to run (and configure) the test suite simply:

~~~ sh
cd Cloudant
npm install
npm test
~~~

after adding a new test you can run it individually (with verbose output) using:

~~~ sh
Cloudant_env=testing node tests/doc/list.js list_doc_params
~~~

where `list_doc_params` is the test name.

## Development

To join the effort developing this project, start from our GitHub page: https://github.com/cloudant/nodejs-cloudant

First clone this project from GitHub, and then install its dependencies using npm.

    $ git clone https://github.com/cloudant/nodejs-cloudant
    $ npm install

## Test Suite

We use npm to handle running the test suite. To run the comprehensive test suite, just run `npm test`. However, to run only the Cloudant-specific bits, we have a custom `test-cloudant` script.

    $ npm run test-cloudant

    > cloudant@5.10.1 test-cloudant /Users/jhs/src/cloudant/nodejs-cloudant
    > env NOCK=on sh tests/cloudant/run-tests.sh

    Test against mocked local database

      /tests/cloudant/auth.js

    ✔ 5/5 cloudant:generate_api_key took 196ms
    ✔ 3/3 cloudant:set_permissions took 7ms
    ✔ 8/8 summary took 224ms
    <...cut a bunch of test output...>

This runs against a local "mock" web server, called Nock. However the test suite can also run against a live Cloudant service. I have registered "nodejs.cloudant.com" for this purpose. To use it, run the `test-cloudant-live` script.

    $ npm run test-cloudant-live

    > cloudant@5.10.1 test-cloudant-live /Users/jhs/src/cloudant/nodejs-cloudant
    > sh tests/cloudant/run-tests.sh

    Test against mocked local database

      /tests/cloudant/auth.js

    ✔ 5/5 cloudant:generate_api_key took 192ms
    ✔ 3/3 cloudant:set_permissions took 7ms
    ✔ 8/8 summary took 221ms
    <...cut a bunch of test output...>

Unfortunately you need to know the password.

    $ npm run test-cloudant-live

    > cloudant@5.10.1 test-cloudant-live /Users/jhs/src/cloudant/nodejs-cloudant
    > sh tests/cloudant/run-tests.sh

    Test against remote Cloudant database
    No password configured for remote Cloudant database. Please run:

    npm config set cloudant_password "<your-password>"

    npm ERR! cloudant@5.10.1 test-cloudant-live: `sh tests/cloudant/run-tests.sh`
    <...cut npm error messages...>

Get the password from Jason somehow, and set it as an npm variable.

    # Note the leading space to keep this command out of the Bash history.
    $  npm config set cloudant_password "ask jason for the password" # <- Not the real password
    $ npm run test-cloudant-live
    <...cut successful test suite run...>

## Using in Other Projects

If you work on this project plus another one, your best bet is to clone from GitHub and then *link* this project to your other one. With linking, your other project depends on this one; but instead of a proper install, npm basically symlinks this project into the right place.

Go to this project and "link" it into the global namespace (sort of an "export").

    $ cd cloudant
    $ npm link
    /Users/jhs/.nvm/v0.10.25/lib/node_modules/cloudant -> /Users/jhs/src/cloudant/nodejs-cloudant

Go to your project and "link" it into there (sort of an "import").

    $ cd ../my-project
    $ npm link cloudant
    /Users/jhs/src/my-project/node_modules/cloudant -> /Users/jhs/.nvm/v0.10.25/lib/node_modules/cloudant -> /Users/jhs/src/cloudant/nodejs-cloudant

Now your project has the dependency in place, however you can work on both of them in tandem.

## License

Copyright 2014 Cloudant, an IBM company.

Licensed under the apache license, version 2.0 (the "license"); you may not use this file except in compliance with the license.  you may obtain a copy of the license at

    http://www.apache.org/licenses/LICENSE-2.0.html

Unless required by applicable law or agreed to in writing, software distributed under the license is distributed on an "as is" basis, without warranties or conditions of any kind, either express or implied. See the license for the specific language governing permissions and limitations under the license.

[nano]: https://github.com/dscape/nano
[query]: http://docs.cloudant.com/api/cloudant-query.html
[search]: http://docs.cloudant.com/api/search.html
[auth]: http://docs.cloudant.com/api/authz.html
[issues]: https://github.com/cloudant/nodejs-cloudant/issues
[follow]: https://github.com/iriscouch/follow
[request]:  https://github.com/mikeal/request
