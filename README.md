# Cloudant Node.js Client

This is the official Cloudant library for Node.js.

[![Build Status](https://travis-ci.org/cloudant/nodejs-cloudant.svg?branch=master)](https://travis-ci.org/cloudant/nodejs-cloudant)

<details>
  <summary>Table of Contents</summary>

  * [Installation and Usage](#installation-and-usage)
  * [Getting Started](#getting-started)
    * [Initialization](#initialization)
    * [Initialization Callback](#initialization-callback)
    * [Callback Signature](#callback-signature)
    * [Request Plugins](#request-plugins)
  * [API Reference](#api-reference)
  * [Authorization and API Keys](#authorization-and-api-keys)
    * [Generate an API key](#generate-an-api-key)
    * [Use an API Key](#use-an-api-key)
  * [CORS](#cors)
  * [Virtual Hosts](#virtual-hosts)
  * [Cloudant Query](#cloudant-query)
  * [Cloudant Search](#cloudant-search)
  * [Cloudant Geospatial](#cloudant-geospatial)
  * [TypeScript Support](#typescript-support)
  * [Advanced Features](#advanced-features)
    * [Debugging](#debugging)
    * [Advanced Configuration](#advanced-configuration)
    * [TLS 1.2 Support](#tls-12-support)
    * [Pool size and open sockets](#pool-size-and-open-sockets)
    * [Extending the Cloudant Library](#extending-the-cloudant-library)
    * [Pipes](#pipes)
  * [Development and Contribution](#development-and-contribution)
    * [Local Development](#local-development)
    * [Test Suite](#test-suite)
    * [Using in Other Projects](#using-in-other-projects)
    * [Security Note](#security-note)
  * [License](#license)
  * [Reference](#reference)

</details>

## Installation and Usage

The best way to use the Cloudant client is to begin with your own Node.js project, and define this work as your dependency. In other words, put me in your package.json dependencies. The `npm` tool can do this for you, from the command line:

    $ npm install --save @cloudant/cloudant

Notice that your package.json will now reflect this package. Everything is working if you can run this command with no errors:

    $ node -e 'require("@cloudant/cloudant"); console.log("Cloudant works");'
    Cloudant works

### Getting Started

Now it's time to begin doing real work with Cloudant and Node.js.

Initialize your Cloudant connection by supplying your *account* and *password*, and supplying a callback function to run when everything is ready.

~~~ js
// Load the Cloudant library.
var Cloudant = require('@cloudant/cloudant');

var me = 'nodejs'; // Set this to your own account
var password = process.env.cloudant_password;

// Initialize the library with my account.
var cloudant = Cloudant({account:me, password:password});

cloudant.db.list(function(err, allDbs) {
  console.log('All my databases: %s', allDbs.join(', '))
});
~~~

Possible output (depending on your databases, of course):

     All my databases: example_db, jasons_stuff, scores

Upper-case `Cloudant` is this package you load using `require()`, while lower-case `cloudant` represents an authenticated, confirmed connection to your Cloudant service.

If you omit the "password" field, you will get an "anonymous" connection: a client that sends no authentication information (no passwords, no cookies, etc.)

To use the example code as-is, you must first install the `dotenv` package from npm, then create a `.env` file with your Cloudant credentials. For example:

~~~
npm install dotenv                               # Install ./node_modules/dotenv
echo "/.env"                       >> .gitignore # Do not track .env in the revision history
echo "cloudant_username=myaccount" >  .env       # Replace myaccount with your account name
echo "cloudant_password='secret'"  >> .env       # Replace secret with your password
~~~

Here is simple but complete example of working with data:

~~~ js
require('dotenv').load();

// Load the Cloudant library.
var Cloudant = require('@cloudant/cloudant');

// Initialize Cloudant with settings from .env
var username = process.env.cloudant_username || "nodejs";
var password = process.env.cloudant_password;
var cloudant = Cloudant({account:username, password:password});

// Remove any existing database called "alice".
cloudant.db.destroy('alice', function(err) {

  // Create a new "alice" database.
  cloudant.db.create('alice', function() {

    // Specify the database we are going to use (alice)...
    var alice = cloudant.db.use('alice')

    // ...and insert a document in it.
    alice.insert({ crazy: true }, 'panda', function(err, body, headers) {
      if (err) {
        return console.log('[alice.insert] ', err.message);
      }

      console.log('You have inserted the panda.');
      console.log(body);
    });
  });
});
~~~

If you run this example, you will see:

    You have inserted the panda.
    { ok: true,
      id: 'panda',
      rev: '1-6e4cb465d49c0368ac3946506d26335d' }

You can find a further CRUD example in the [example](https://github.com/cloudant/nodejs-cloudant/tree/master/example) directory of this project.

### Initialization

To use Cloudant, add `require('@cloudant/cloudant')` in your code. In general, the common style is that `Cloudant` (upper-case) is the **package** you load; whereas `cloudant` (lower-case) is your connection to your database (i.e. the result of calling `Cloudant()`).

You can initialize your client in _one_ of the following ways:

#### 1. Using a URL:

You can initialize Cloudant with a URL:

~~~ js
var Cloudant = require('@cloudant/cloudant')
var cloudant = Cloudant("http://MYUSERNAME:MYPASSWORD@localhost:5984");
~~~

**Note**: If you pass in a `username`, `password`, and `url` that contains credentials, the `username` and `password` will supercede the credentials within the `url`.  For example, `myusername` and `mypassword` will be used in the code below during authentication:
~~~ js
var Cloudant = require('@cloudant/cloudant')
var cloudant = Cloudant({username:'myusername', password:'mypassword', url:'http://user:pass@localhost:5984'});
~~~

#### 2. Using account credentials:

##### 2.1. Connecting to Cloudant

You can just pass your account name and password (see the [security note](#security-note) about placing your password into your source code).

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({account:me, password:password});
~~~

By default, when you connect to your cloudant account (i.e. "me.cloudant.com"), you authenticate as the account owner (i.e. "me"). However, you can use Cloudant with any username and password. Just provide an additional "username" option when you initialize Cloudant. This will connect to your account, but using the username as the authenticated user. (And of course, use the appropriate password.)

~~~ js
var Cloudant = require('@cloudant/cloudant');
var me = "nodejs";         // Substitute with your Cloudant user account.
var otherUsername = "jhs"; // Substitute with some other Cloudant user account.
var otherPassword = process.env.other_cloudant_password;

Cloudant({account:me, username:otherUsername, password:otherPassword}, function(er, cloudant, reply) {
  if (er) {
    throw er;
  }

  console.log('Connected with username: %s', reply.userCtx.name);
});
~~~

##### 2.2. Connecting to Cloudant Local

If you use Cloudant Local, everything works exactly the same, except you provide a *url* parameter to indicate which server to use:

~~~ js
Cloudant({url:"companycloudant.local", username:"somebody", password:"somebody's secret"}, function(er, cloudant, reply) {
  if (er)
    throw er

  console.log('Connected with username: %s', reply.userCtx.name)
})
~~~

#### 3. Using a `VCAP_SERVICES` environment variable:

You can initialize Cloudant directly from the `VCAP_SERVICES` environment variable. Just pass `vcapServices` and your `vcapInstanceName` (or alias `instanceName`) in the client configuration:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({ vcapInstanceName: 'foo', vcapServices: JSON.parse(process.env.VCAP_SERVICES) });
~~~

You can also specify a `vcapServiceName` if your service name isn't the default, namely 'cloudantNoSQLDB'.

Note, if you only have a single Cloudant service then specifying the `vcapInstanceName` isn't required.

### Initialization Callback

You can optionally provide a callback to the Cloudant initialization function. This will make the library automatically "ping" Cloudant to confirm the connection and that your credentials work.

Here is a simple example of initializing asynchronously, using its optional callback parameter:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var me = 'nodejs'; // Replace with your account.
var password = process.env.cloudant_password;

Cloudant({account:me, password:password}, function(err, cloudant) {
  if (err) {
    return console.log('Failed to initialize Cloudant: ' + err.message);
  }

  var db = cloudant.db.use("animals");
  db.get("dog", function(err, data) {
    // The rest of your code goes here. For example:
    console.log("Found dog:", data);
  });
});
~~~

### Callback Signature

Callback functions receive three arguments:

```js
function(err, body, headers) {}
```

* `err` - The _error_ (if any). For example, fetching a document that doesn't exist:

```js
var mydb = cloudant.db.use('mydb');
mydb.get('non-existent-doc', function(err, data) {
    console.log(err);
});
```

```
{ Error: deleted
    at Object.clientCallback (/usr/src/app/node_modules/nano/lib/nano.js:248:15)
    at Request._callback (/usr/src/app/node_modules/@cloudant/cloudant/lib/clientutils.js:154:11)
    ...
  name: 'Error',
  error: 'not_found',
  reason: 'deleted',
  scope: 'couch',
  statusCode: 404,
  request:
   { method: 'GET',
     headers:
      { 'content-type': 'application/json',
        accept: 'application/json' },
     uri: 'http://localhost:5984/_users/895c3440-42e7-11e8-b9b2-358fa5dee4a0' },
  headers:
  { 'x-couchdb-body-time': '0',
    'x-couch-request-id': '1c16b2b81f',
    'transfer-encoding': 'chunked',
    etag: '"7Q4MT2X8W1RO3JQOLSA4KGMV7"',
    date: 'Fri, 27 Apr 2018 08:49:26 GMT',
    'content-type': 'application/json',
    'cache-control': 'must-revalidate',
    statusCode: 404,
    uri: 'http://localhost:5984/_users/895c3440-42e7-11e8-b9b2-358fa5dee4a0' },
  errid: 'non_200',
  description: 'couch returned 404' }
```

As shown above, the corresponding database `request`, `headers` and `statusCode` are also returned in the error.

* `body` - The HTTP _response body_ (if no error). For example:

```js
cloudant.db.list(function(err, body, headers) {
    console.log(body);
});
```

```
[ '_replicator', '_users' ]
```

* `headers` - The HTTP _response headers_ (if no error). For example:

```js
cloudant.db.list(function(err, body, headers) {
    console.log(headers);
});
```

```
{ 'x-couchdb-body-time': '0',
  'x-couch-request-id': '591be401f1',
  'transfer-encoding': 'chunked',
  etag: '"7Q4MT2X8W1RO3JQOLSA4KGMV7"',
  date: 'Fri, 27 Apr 2018 08:49:49 GMT',
  'content-type': 'application/json',
  'cache-control': 'must-revalidate',
  statusCode: 200,
  uri: 'http://localhost:5984/_all_dbs' }
```

Note that the `statusCode` and `uri` and also included amongst the response headers.

### Request Plugins

The library is easily extendable via the use of plugins. They provide the ability to intercept a request:
1. Before the request is submitted to the server.
2. After the response headers are received.
3. If the underlying HTTP client emits an `error` event.

Plugins can be used to modify an outgoing request, edit an incoming response or even retry a request entirely.

#### Plugin Configuration

The `maxAttempt` is a global configuration that applies to all plugins. It's the maximum number of times the request will be attempted _(default: 3)_.

All other configuration is plugin specific. It must be passed within an object to the `plugins` parameter in the client constructor. For example:

```js
var cloudant = new Cloudant({ url: myurl, maxAttempt: 5, plugins: [ 'iamauth', { retry: { retryDelayMultiplier: 4 } } ]);
```

`maxAttempt` can _not_ be overridden by plugin specific configuration.

#### The Plugins

1. `cookieauth`

   This plugin will automatically exchange your Cloudant credentials for a cookie. It will handle the authentication and ensure that the cookie is refreshed as required.

   For example:
   ```js
   var cloudant = new Cloudant({ url: 'https://user:pass@examples.cloudant.com', plugins: 'cookieauth' });
   var mydb = cloudant.db.use('mydb');
   mydb.get('mydoc', function(err, data) {
     console.log(`Document contents: ${data.toString('utf8')}`);
   });
   ```

   The plugin will transparently call `POST /_session` to exchange your credentials for a cookie before proceeding with the document fetch.

   Note that all subsequent requests made using this client will also use cookie authentication. The library will automatically refresh the cookie on any `401` or `403` response.

   If you don't specify a username and password during the client construction then cookie authentication is disabled.

2. `iamauth`

   IBM Cloud Identity & Access Management enables you to securely authenticate users and control access to all cloud resources consistently in the IBM Bluemix Cloud Platform.

   This plugin will automatically exchange your IAM API key for a token. It will handle the authentication and ensure that the token is refreshed as required.

   The production IAM token service at https://iam.bluemix.net/identity/token is used by default. You can set `iamTokenUrl` in your plugin configuration to override this.

   For example:
   ```js
   var cloudant = new Cloudant({ url: 'https://examples.cloudant.com', plugins: { iamauth: { iamApiKey: 'xxxxxxxxxx' } } });
   var mydb = cloudant.db.use('mydb');
   mydb.get('mydoc', function(err, data) {
     console.log(`Document contents: ${data.toString('utf8')}`);
   });
   ```

   See [IBM Cloud Identity and Access Management](https://console.bluemix.net/docs/services/Cloudant/guides/iam.html#ibm-cloud-identity-and-access-management) for more information.

3. `promises`

   If you'd prefer to write code in the _Promises_ style then the `promises` plugin turns each request into a _Promise_.

   For example:
   ```js
   var cloudant = new Cloudant({ url: myurl, plugins: 'promises' });
   var mydb = cloudant.db.use('mydb');
   ```

   Then the library will return a _Promise_ for every asynchronous call:
   ```js
   mydb.list().then(function(data) {
     console.log(data);
   }).catch(function(err) {
     console.log('something went wrong', err);
   });
   ```

4. `retry`

   This plugin will retry requests on error (e.g. connection reset errors) or on a predetermined HTTP status code response using an exponential back-off.

   For example, Cloudant may reply with an HTTP 429 response because you've exceed the number of API requests in a given amount of time. You can ensure these requests are suitably retried:

   ```js
   var cloudant = new Cloudant({ url: myurl, maxAttempt: 5, plugins: { retry: { retryErrors: false, retryStatusCodes: [ 429 ] } } });
   ```

   The plugin has the following configuration options:

    - `retryDelayMultiplier`

      The multiplication factor used for increasing the timeout after each subsequent attempt _(default: 2)_.

    - `retryErrors`

      Automatically retry a request on error (e.g. connection reset errors) _(default: true)_.

    - `retryInitialDelayMsecs`

      The initial retry delay in milliseconds _(default: 500)_.

    - `retryStatusCodes`

      A list of HTTP status codes that should be retried _(default: 429, 500, 501, 502, 503, 504)_.

#### Using Multiple Plugins

You can pass the plugins as an array, for example:
```js
var cloudant = new Cloudant({ url: myurl, plugins: [ 'cookieauth', 'promises', { retry: { retryDelayMultiplier: 4 } } ] });
var mydb = cloudant.db.use('mydb');
mydb.get('mydoc', function(err, data) {
  console.log(`Document contents: ${data.toString('utf8')}`);
});
```

The plugins are _always_ executed in the order they are specified. Remember that all plugins are respected. If one requests a retry then it cannot be overruled by another. If two plugins request different delay times before the next retry attempt then the largest delay time is honoured.

Be aware that if you don't specify any plugins then the `cookieauth` plugin will automatically be added. To disable all plugins you can pass an empty array as the plugin list, i.e. `Cloudant({ url: myurl, plugins: [] })`.

## API Reference

Cloudant is a wrapper around the Nano library and as such, Nano's documentation should be consulted for:

- [Database functions](https://github.com/cloudant-labs/cloudant-nano#database-functions)
- [Document functions](https://github.com/cloudant-labs/cloudant-nano#document-functions)
- [Multipart functions](https://github.com/cloudant-labs/cloudant-nano#multipart-functions)
- [Attachment functions](https://github.com/cloudant-labs/cloudant-nano#attachments-functions)
- [View and Design functions](https://github.com/cloudant-labs/cloudant-nano#views-and-design-functions)

This library adds documentation for the following:

- [Authorization and API Keys](#authorization-and-api-keys)
  - [Generate an API key](#generate-an-api-key)
  - [Use an API Key](#use-an-api-key)
- [CORS](#cors)
- [Cloudant Query](#cloudant-query)
- [Cloudant Search](#cloudant-search)
- [Cloudant Geospatial](#cloudant-geospatial)
- [Advanced Features](#advanced-features)
  - [Advanced Configuration](#advanced-configuration)
  - [Pool size and open sockets](#pool-size-and-open-sockets)
  - [Extending the Cloudant Library](#extending-the-cloudant-library)
  - [Pipes](#pipes)
- [Development](#development)
  - [Test Suite](#test-suite)
  - [Using in Other Projects](#using-in-other-projects)
- [License](#license)
- [Reference](#reference)


## Authorization and API Keys

This feature interfaces with the Cloudant [authorization API][Authorization].

Use the authorization feature to generate new API keys to access your data. An API key is basically a username/password pair for granting others access to your data, without giving them the keys to the castle.

### Generate an API key

~~~ js
var Cloudant = require('@cloudant/cloudant');
var me = 'nodejs'; // Replace with your account.
var password = process.env.cloudant_password;
var cloudant = Cloudant({account:me, password:password});

cloudant.generate_api_key(function(er, api) {
  if (er) {
    throw er; // You probably want wiser behavior than this.
  }

  console.log('API key: %s', api.key);
  console.log('Password for this key: %s', api.password);
  console.log('');

  // Set the security for three users: nobody, nodejs, and the above API key.
  // (The "nodejs" user is an example account that belongs to IBM Cloudant.)
  var db = "animals";
  var security = {
    nobody: [],
    nodejs : [ '_reader', '_writer', '_admin', '_replicator' ]
  };
  security[api.key] = [ '_reader', '_writer' ];

  var my_database = cloudant.db.use(db);
  my_database.set_security(security, function(er, result) {
    if (er) {
      throw er;
    }

    console.log('Set security for ' + db);
    console.log(result);
    console.log('');

    // Or you can read the security settings from a database.
    my_database.get_security(function(er, result) {
      if (er) {
        throw er;
      }

      console.log('Got security for ' + db);
      console.log(result);
    });
  });
});
~~~

Output:

    API key: thandoodstrenterprourete
    Password for this key: Eivln4jPiLS8BoTxjXjVukDT

    Set security for animals
    { ok: true }

    Got security for animals
    { cloudant:
      { nobody: [],
        thandoodstrenterprourete: [ '_reader', '_writer' ],
        nodejs: [ '_reader', '_writer', '_admin', '_replicator' ] } }

See the [Authorization] documentation for further details.

### Use an API Key

To use an API key, initialize a new Cloudant connection, and provide an additional "key" option when you initialize Cloudant. This will connect to your account, but using the "key" as the authenticated user. (And of course, use the appropriate password associated with the API key.)

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({account:"me", key:api.key, password:api.password});
~~~

## CORS

If you need to access your Cloudant database from a web application that is served from a domain other than your Cloudant account, you will need to enable CORS (Cross-origin resource sharing).

e.g. enable CORS from any domain:

~~~ js
cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: ["*"]}, function(err, data) {
  console.log(err, data);
});
~~~

or enable access from a list of specified domains:

~~~ js
cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: [ "https://mydomain.com","https://mysubdomain.mydomain.com"]}, function(err, data) {
  console.log(err, data);
});
~~~

or disable CORS access

~~~ js
cloudant.set_cors({ enable_cors: false, origins: [] }, function(err, data) {
  console.log(err, data);
});
~~~

or to fetch the current CORS configuration

~~~ js
cloudant.get_cors(function(err, data) {
  console.log(data);
});
~~~

Output:

    { enable_cors: true, allow_credentials: true, origins: [ '*' ] }

See [CORS] for further details.


## Virtual Hosts

If you wish to access your Cloudant domain name (myaccount.cloudant.com) using a CNAME'd domain name (mysubdomain.mydomain.com) then you can
instruct Cloudant to do so.

e.g. add a virtual host
~~~ js
cloudant.add_virtual_host({ host: "mysubdomain.mydomain.com", path: "/mypath"}, function(err, data) {
  console.log(err, data);
});
~~~

e.g. view virtual host configuration

~~~ js
cloudant.get_virtual_hosts(function(err, data) {
  console.log(err, data);
});
~~~

or delete a virtual host
~~~ js
cloudant.delete_virtual_host({ host: "mysubdomain.mydomain.com", path: "/mypath"}, function(err, data) {
  console.log(err, data);
});
~~~

## Cloudant Query

This feature interfaces with Cloudant's query functionality. See the [Cloudant Query documentation][Cloudant Query] for details.

As with Nano, when working with a database (as opposed to the root server), run the `.db.use()` method.

~~~ js
var db = cloudant.db.use('my_db')
~~~

To see all the indexes in a database, call the database `.index()` method with a callback function.

~~~ js
db.index(function(er, result) {
  if (er) {
    throw er;
  }

  console.log('The database has %d indexes', result.indexes.length);
  for (var i = 0; i < result.indexes.length; i++) {
    console.log('  %s (%s): %j', result.indexes[i].name, result.indexes[i].type, result.indexes[i].def);
  }

  result.should.have.a.property('indexes').which.is.an.Array;
  done();
});
~~~

Example output:

    The database has 3 indexes
      _all_docs (special): {"fields":[{"_id":"asc"}]}
      first-name (json): {"fields":[{"name":"asc"}]}
      last-name (json): {"fields":[{"name":"asc"}]}

To create an index, use the same `.index()` method but with an extra initial argument: the index definition. For example, to make an index on middle names in the data set:

~~~ js
var first_name = {name:'first-name', type:'json', index:{fields:['name']}}
db.index(first_name, function(er, response) {
  if (er) {
    throw er;
  }

  console.log('Index creation result: %s', response.result);
});
~~~

Output:

    Index creation result: created

To query using the index, use the `.find()` method.

~~~ js
db.find({selector:{name:'Alice'}}, function(er, result) {
  if (er) {
    throw er;
  }

  console.log('Found %d documents with name Alice', result.docs.length);
  for (var i = 0; i < result.docs.length; i++) {
    console.log('  Doc id: %s', result.docs[i]._id);
  }
});
~~~


## Cloudant Search

This feature interfaces with Cloudant's search functionality. See the [Cloudant Search documentation][Cloudant Search] for details.

First, when working with a database (as opposed to the root server), run the `.use()` method.

~~~ js
var db = cloudant.db.use('my_db')
~~~

In this example, we will begin with some data to search: a collection of books.

~~~
var books = [
  {author:"Charles Dickens", title:"David Copperfield"},
  {author:"David Copperfield", title:"Tales of the Impossible"},
  {author:"Charles Dickens", title:"Great Expectation"}
]

db.bulk({docs:books}, function(er) {
  if (er) {
    throw er;
  }

  console.log('Inserted all documents');
});
~~~

To create a Cloudant Search index, create a design document the normal way you would with Nano, the database `.insert()` method.

To see all the indexes in a database, call the database `.index()` method with a callback function.

~~~ js
// Note, you can make a normal JavaScript function. It is not necessary
// for you to convert it to a string as with other languages and tools.
var book_indexer = function(doc) {
  if (doc.author && doc.title) {
    // This looks like a book.
    index('title', doc.title);
    index('author', doc.author);
  }
}

var ddoc = {
  _id: '_design/library',
  indexes: {
    books: {
      analyzer: {name: 'standard'},
      index   : book_indexer
    }
  }
};

db.insert(ddoc, function (er, result) {
  if (er) {
    throw er;
  }

  console.log('Created design document with books index');
});
~~~

To query this index, use the database `.search()` method. The first argument is the design document name, followed by the index name, and finally an object with your search parameters.

~~~ js
db.search('library', 'books', {q:'author:dickens'}, function(er, result) {
  if (er) {
    throw er;
  }

  console.log('Showing %d out of a total %d books by Dickens', result.rows.length, result.total_rows);
  for (var i = 0; i < result.rows.length; i++) {
    console.log('Document id: %s', result.rows[i].id);
  }
});
~~~

## Cloudant Geospatial

This feature interfaces with Cloudant's geospatial features. See the [Cloudant Geospatial documentation][Cloudant Geospatial] for details.

Begin with a database, and insert documents in [GeoJSON format][geojson]. Documents should have `"type"` set to `"Feature"` and also `"geometry"` with a valid GeoJSON value. For example:

~~~ js
var db = cloudant.db.use('my_db')
var cities = [
  { "_id":"Boston",
    "type":"Feature",
    "geometry": {
      "type":"Point","coordinates": [-71.063611, 42.358056]
    }
  },
  { "_id":"Houston",
    "type":"Feature",
    "geometry": {
      "type":"Point","coordinates": [-95.383056, 29.762778]
    }
  },
  { "_id":"Ruston",
    "type":"Feature",
    "geometry": {
      "type":"Point","coordinates": [-92.640556, 32.529722]
    }
  }
];

db.bulk({docs:cities}, function(er) {
  if (er) {
    throw er;
  }

  console.log('Inserted all cities');
});
~~~

To make a spatial index of these documents, create a design document with `"st_indexes"` populated with a JavaScript indexing function.

~~~ js
// Note, you can make a normal JavaScript function. It is not necessary
// for you to convert it to a string as with other languages and tools.
var city_indexer = function(doc) {
  if (doc.geometry && doc.geometry.coordinates) {
    st_index(doc.geometry);
  }
};

var ddoc = {
  _id: '_design/city',
  st_indexes: {
    city_points: {
      index: city_indexer
    }
  }
};

db.insert(ddoc, function (er, result) {
  if (er) {
    throw er;
  }

  console.log('Created design document with city index');
});
~~~

To query this index, use the database `.geo()` method. The first argument is the design document name, followed by the index name, and finally an object with your search parameters.

~~~ js
// Find the city within 25km (15 miles) of Lexington, MA.
var query = {
  lat:42.447222, lon:-71.225,
  radius:25000,
  include_docs:true
};

db.geo('city', 'city_points', query, function(er, result) {
  if (er) {
    throw er;
  }

  console.log('Cities found: %d', result.rows.length); // "Cities found: 1"
  console.log(result.rows[0].doc._id);                 // "Boston"
});
~~~

## TypeScript Support

TypeScript is a superset of JavaScript which primarily provides optional static
typing, classes and interfaces. One of the big benefits is to enable IDEs to
provide a richer environment for spotting common errors as you type the code.

The `nodejs-cloudant` package includes TypeScript declaration files. It also
pulls in declaration files for its core dependencies (namely `nano` and
`request`).

TypeScript compiles to clean, simple JavaScript code which runs on any browser,
in Node.js, or in any JavaScript engine that supports ECMAScript 3 (or newer).

_Note:_ The TypeScript declaration files do not support `Promise` return
types. To silence compiler warnings you must cast your return type to the `Any`
type. For example:

```js
import * as Cloudant from '@cloudant/cloudant';

var client = Cloudant({ account: 'me', password: 'password', plugins: [ 'promises' ] });

(client.db.list() as any).then((d) => { console.log(d); });
```

See [here](https://www.typescriptlang.org) for further details.

## Advanced Features

### Debugging

Enable debugging output by setting the following environment variable:

    export DEBUG=cloudant*
    # then run your Node.js application

There are several debuggers used within the library. You can capture output from a specific debugger. Here are some examples:

- `DEBUG="cloudant:client"`
  Only show events from the underlying request client.
- `DEBUG="cloudant:plugins*"`
  Only show events from plugins.
- `DEBUG="cloudant:plugins:cookieauth"`
  Only show events from the cookie authentication plugin (if enabled).
- `DEBUG="cloudant:plugins:iamauth"`
  Only show events from the IAM authentication plugin (if enabled).

You can also get debugging output from nodejs-cloudant dependencies too:

    export DEBUG=cloudant*,nano
    export NODE_DEBUG=request
    # then run your Node.js application

This will show all HTTP requests and responses made by the library. Be aware that credentials are also logged.

### Advanced Configuration

Besides the account and password options, you can add an optional `requestDefaults` value, which will initialize Request (the underlying HTTP library) as you need it.

~~~ js

// Use an HTTP proxy to connect to Cloudant.
var options =
  { "account"         : "my_account"
  , "password"        : "secret"
  , "requestDefaults": { "proxy": "http://localhost:8080" }
  }
var cloudant = require('@cloudant/cloudant')(opts);
// Now using the HTTP proxy...

~~~

Please check [Request][request] for more information on the defaults. They support features like cookie jar, proxies, ssl, etc.

### TLS 1.2 Support

If your server enforces the use of TLS 1.2 then the nodejs-cloudant client will continue to work as expected (assuming you're running a version of Node/OpenSSL that supports TLS 1.2).

### Pool size and open sockets

A very important configuration parameter if you have a high traffic website and are using Cloudant
is setting up the pool size. By default, the nodejs-cloudant agent is configured to use a maximum of
6 sockets.

You can change the maximum number of sockets by passing a custom agent to `requestDefaults`.

Here is an example where the agent is configured with a maximum of 50 sockets and a keep-alive time
of 30s:

~~~ js
var protocol = require('https');
var myagent = new protocol.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50
});
var cloudant = require('@cloudant/cloudant')({account:"me", password:"secret", requestDefaults:{agent:myagent}});
// Using Cloudant with myagent...
~~~

For more details, refer to the [Request][request] documentation and examples.

### Extending the Cloudant Library

Cloudant is minimalistic but you can add your own features with `cloudant.request(opts, callback)`

For example, to create a function to retrieve a specific revision of the `panda` document:

~~~ js
function getpandarev(rev, callback) {
  cloudant.request({ db: 'alice',
                     doc: 'panda',
                     method: 'get',
                     params: { rev: rev }
                   }, callback)
}

getpandarev('4-2e6cdc4c7e26b745c2881a24e0eeece2', function(err, body) {
  if (!err)
    console.log(body)
})
~~~

### Pipes

You can pipe in Cloudant like in any other stream.  for example if our `panda` document has an attachment with name `picture.png` (with a picture of our white panda, of course!) you can pipe it to a `writable
stream`

See the [Attachment Functions](#attachment-functions) section for examples of piping to and from attachments.


## Development and Contribution

This is an open-source library, published under the Apache 2.0 license. We very much welcome contributions to the project so if you would like
to contribute (even if it's fixing a typo in the README!) simply

* fork this repository. Visit https://github.com/cloudant/nodejs-cloudant and click the "Fork" button.
* commit changes into your copy of the repository
* when you're ready, create a Pull Request to contribute your changes back into this project

If you're not confident about being able to fix a problem yourself, or want to simply [report an issue](https://github.com/cloudant/nodejs-cloudant/issues) then please.

### Local Development

To join the effort developing this project, start from our GitHub page: https://github.com/cloudant/nodejs-cloudant

First clone this project from GitHub, and then install its dependencies using npm.

    $ git clone https://github.com/cloudant/nodejs-cloudant
    $ npm install

### Test Suite

We use npm to handle running the test suite. To run the comprehensive test suite, just run `npm test`.

or after adding a new test you can run it individually (with verbose output) using:

~~~ sh
npm test-verbose
~~~

This runs against a local "mock" web server, called Nock. However the test suite can also run against a live Cloudant service. I have registered "nodejs.cloudant.com" for this purpose.

~~~ sh
    $ npm test-live
~~~

Get the password from Jason somehow, and set it a file called `.env` at the root of this project:

    cloudant_password=thisisthepassword

### Using in Other Projects

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

### Security Note

**DO NOT hard-code your password and commit it to Git**. Storing your password directly in your source code (even in old commits) is a serious security risk to your data. Whoever gains access to your software will now also have read, write, and delete access to your data. Think about GitHub security bugs, or contractors, or disgruntled employees, or lost laptops at a conference. If you check in your password, all of these situations become major liabilities. (Also, note that if you follow these instructions, the `export` command with your password will likely be in your `.bash_history` now, which is kind of bad. However, if you input a space before typing the command, it will not be stored in your history.)

Here is simple but complete example of working with data:

~~~ js
var Cloudant = require('@cloudant/cloudant')

var me = 'nodejs' // Set this to your own account
var password = process.env.cloudant_password

Cloudant({account:me, password:password}, function(er, cloudant) {
  if (er)
    return console.log('Error connecting to Cloudant account %s: %s', me, er.message)

  // Clean up the database we created previously.
  cloudant.db.destroy('alice', function() {
    // Create a new database.
    cloudant.db.create('alice', function() {
      // specify the database we are going to use
      var alice = cloudant.db.use('alice')
      // and insert a document in it
      alice.insert({ crazy: true }, 'panda', function(err, body, headers) {
        if (err)
          return console.log('[alice.insert] ', err.message)

        console.log('you have inserted the panda.')
        console.log(body)
      })
    })
  })
})
~~~

If you run this example, you will see:

    you have inserted the panda.
    { ok: true,
      id: 'panda',
      rev: '1-6e4cb465d49c0368ac3946506d26335d' }

## License

Copyright (c) 2016 IBM Cloudant, Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing permissions
and limitations under the License.


## Reference

* [Nano Library]
* [Cloudant Documentation]
* [Cloudant Query]
* [Cloudant Search]
* [Authentication]
* [Authorization]
* [CORS]
* [Issues]
* [Follow library]

[Nano Library]: https://github.com/cloudant-labs/cloudant-nano
[Cloudant Documentation]: https://console.bluemix.net/docs/services/Cloudant/cloudant.html#overview
[Cloudant Query]: https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#query
[Cloudant Search]: https://console.bluemix.net/docs/services/Cloudant/api/search.html
[Cloudant Geospatial]: https://console.bluemix.net/docs/services/Cloudant/api/cloudant-geo.html#cloudant-geospatial
[Authentication]: https://console.bluemix.net/docs/services/Cloudant/api/authentication.html
[Authorization]: https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#authorization
[geojson]: http://geojson.org/
[CORS]: https://console.bluemix.net/docs/services/Cloudant/api/cors.html#cors
[Issues]: https://github.com/cloudant/nodejs-cloudant/issues
[Follow library]: https://github.com/cloudant-labs/cloudant-follow
[request]: https://github.com/request/request
