# DEPRECATED

**This library is now deprecated and will be end-of-life on Dec 31 2021.**

The library remains supported until the end-of-life date,
but will receive only _critical_ maintenance updates.

Please see the [Migration Guide](./MIGRATION.md) for advice
about migrating to our replacement library
[cloudant-node-sdk](https://github.com/IBM/cloudant-node-sdk).

For FAQs and additional information please refer to the
[Cloudant blog](https://blog.cloudant.com/2021/06/30/Cloudant-SDK-Transition.html).

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
  * [Authorization and Cloudant API Keys](#authorization-and-cloudant-api-keys)
    * [Generate a Cloudant API key](#generate-a-cloudant-api-key)
    * [Use a Cloudant API Key](#use-a-cloudant-api-key)
  * [CORS](#cors)
  * [Cloudant Query](#cloudant-query)
  * [Cloudant Search](#cloudant-search)
  * [Cloudant Geospatial](#cloudant-geospatial)
  * [TypeScript Support](#typescript-support)
  * [Advanced Features](#advanced-features)
    * [Partitioned Databases](#partitioned-databases)
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
  * [Migrating to `cloudant-node-sdk` library](#migrating-to-cloudant-node-sdk-library)
  * [License](#license)
  * [Reference](#reference)

</details>

## Installation and Usage

Run the following command to install the `@cloudant/cloudant` package (and all
packages that it depends on):

    $ npm install --save @cloudant/cloudant

Notice that your `package.json` file will now reference this package in its list
of dependencies. Ensure you can execute this command without encountering
errors:

    $ node -e 'require("@cloudant/cloudant"); console.log("Cloudant works");'
    Cloudant works

### Getting Started

Initialize your Cloudant connection by supplying your `url` and credentials.

~~~ js
// Load the Cloudant library.
var Cloudant = require('@cloudant/cloudant');

// Get account details from environment variables
var url = process.env.cloudant_url;
var username = process.env.cloudant_username;
var password = process.env.cloudant_password;

// Initialize the library with url and credentials.
var cloudant = Cloudant({ url: url, username: username, password: password });
~~~

If you omit the `password` in your configuration then you get an "anonymous"
connection - a client that sends no authentication information (no passwords, no
cookies, etc.)

To use the example code as-is, you must first install the `dotenv` package from
NPM, then create a `.env` file with your Cloudant credentials. For example:

~~~
npm install dotenv                               # Install ./node_modules/dotenv
echo "/.env"                       >> .gitignore # Do not track .env in the revision history
echo "cloudant_url=https://myaccountid.cloudantnosqldb.appdomain.cloud " >  .env       # Replace myaccountid with your account name
echo "cloudant_username=myuser" >  .env       # Replace myuser with your username
echo "cloudant_password='secret'"  >> .env       # Replace secret with your password
~~~

Here is a simple example of how to use this library:

~~~ js
require('dotenv').load();

// Load the Cloudant library.
var Cloudant = require('@cloudant/cloudant');

// Initialize Cloudant with settings from .env
var url = process.env.cloudant_url;
var username = process.env.cloudant_username;
var password = process.env.cloudant_password;
var cloudant = Cloudant({ url:url, username:username, password:password });

// Using the async/await style.

async function asyncCall() {
  await cloudant.db.create('alice');
  return cloudant.use('alice').insert({ happy: true }, 'rabbit');
}

asyncCall().then((data) => {
  console.log(data); // { ok: true, id: 'rabbit', ...
}).catch((err) => {
  console.log(err);
});

// Using Promises.

cloudant.db.create('alice').then(() => {
  cloudant.use('alice').insert({ happy: true }, 'rabbit').then((data) => {
    console.log(data); // { ok: true, id: 'rabbit', ...
  });
}).catch((err) => {
  console.log(err);
});

// Using Callbacks.

cloudant.db.create('alice', (err) => {
  if (err) {
    console.log(err);
  } else {
    cloudant.use('alice').insert({ happy: true }, 'rabbit', (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log(data); // { ok: true, id: 'rabbit', ...
      }
    });
  }
});
~~~

The code snippets shown in this documentation use a variety of async/await,
promises and callback styles. The library supports them all.

### Initialization

To use Cloudant, add `require('@cloudant/cloudant')` in your code. The common
style is that `Cloudant` (upper-case) is the **package** you load; whereas
`cloudant` (lower-case) is your **connection** to your database (i.e. the result of
calling `Cloudant()`).

The `cloudant` client connection utilizes an agent with a configurable [HTTP
connection pool](#pool-size-and-open-sockets). As such the performance of the
client is improved when re-using the `cloudant` client connection throughout
an application instead of repeatedly re-instantiating. It is important to
instantiate the `cloudant` _connection_ **only once** during the application
lifetime to reduce the overheads of memory usage and other resources such as
unused connections.

You can initialize your client in _one_ of the following ways:

#### 1. Using a URL:

You can initialize Cloudant with a URL:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant("http://MYUSERNAME:MYPASSWORD@localhost:5984");
~~~

**Note**: It is preferred to pass credentials using the `url` and `username` and
`password` configuration options rather than as part of the URL. However, if you
choose to pass credentials in the user information subcomponent of the URL then
they must be [percent encoded](https://tools.ietf.org/html/rfc3986#section-3.2.1).
Specifically within either the username or password the characters `: / ? # [ ] @ %`
_MUST_ be precent-encoded, other characters _MAY_ be percent encoded.
For example for the username `user123` and password `colon:at@321`:
```
https://user123:colon%3aat%40321@localhost:5984
```
Credentials must not be percent encoded when passing them via other configuration
options besides `url`.

If you pass in `username` and `password` options and a `url` that contains
credentials, the `username` and `password` will supercede the credentials within
the `url`.  For example, `myusername` and `mypassword` will be used in the code
below during authentication:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({ username:'myusername', password:'mypassword', url:'http://user:pass@localhost:5984' });
~~~

#### 2. Using account credentials:

##### 2.1. Connecting to Cloudant

You can just pass your account, username and password:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({ account: acct, username: me, password: password });
~~~

_Notes:_
* If you use the `account` option then the account is appended with `.cloudant.com`.
  The `url` option is preferred as `cloudant.com` is no longer the preferred domain.
* If you omit `username` then the `account` will be used as the `username`. This is not
  recommended as the default username for newer Cloudant accounts does not match the account name.

You can use Cloudant with an alternative username and password. Just provide an additional `username` option
when you initialize Cloudant. This will connect to your account, but using the
username as the authenticated user. (And of course, use the appropriate
password.)

~~~ js
var Cloudant = require('@cloudant/cloudant');

var me = "nodejs";         // Substitute with your Cloudant user account.
var otherUsername = "jhs"; // Substitute with some other Cloudant user account.
var otherPassword = process.env.other_cloudant_password;

var cloudant = Cloudant({ account: me, username: otherUsername, password: otherPassword });
~~~

##### 2.2. Connecting to Cloudant Local

If you use Cloudant Local, everything works exactly the same, except you provide
a *url* parameter to indicate which server to use:

~~~ js
var cloudant = Cloudant({ url: "https://company.cloudant.local", username: "somebody", password: "secret" });
~~~

#### 3. Using a `VCAP_SERVICES` environment variable:

You can initialize Cloudant directly from the `VCAP_SERVICES` environment
variable. Just pass `vcapServices` and your `vcapInstanceName` (or alias
`instanceName`) in the client configuration:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({ vcapInstanceName: 'foo', vcapServices: JSON.parse(process.env.VCAP_SERVICES) });
~~~

You can also specify a `vcapServiceName` if your service name isn't the default,
namely 'cloudantNoSQLDB'.

Note, if you only have a single Cloudant service then specifying the
`vcapInstanceName` isn't required.

### Initialization Callback

You can optionally provide a callback to the Cloudant initialization
function. This will make the library automatically
ping Cloudant to confirm the connection and that your credentials work.

Here is a simple example of initializing asynchronously, using its optional
callback parameter:

~~~ js
var Cloudant = require('@cloudant/cloudant');
var url = process.env.cloudant_url;
var username = process.env.cloudant_username;
var password = process.env.cloudant_password;

Cloudant({ url: url, username: username, password: password }, function(err, cloudant, pong) {
  if (err) {
    return console.log('Failed to initialize Cloudant: ' + err.message);
  }
  console.log(pong); // {"couchdb":"Welcome","version": ...
  // Lists all the databases.
  cloudant.db.list().then((body) => {
    body.forEach((db) => {
      console.log(db);
    });
  }).catch((err) => { console.log(err); });
});
~~~

**Note:** For legacy compatibility with older versions of the library using the
initialization callback will always add the `cookieauth` plugin to the list of
configured plugins. If you do not want to use `cookieauth` then you should not
use this initialization callback, instead initalize the client without a
callback and then call the ping function e.g.:

```js
const c = new Cloudant({
  url: 'http://localhost:5984',
  username: 'somebody',
  password: 'something',
  plugins: [] // disable cookieauth
});
c.ping()
  .then(/* do something with response */ console.log)
  .catch(/* handle error */ console.log);
```

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

```js
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
     uri: 'https://example.cloudant.com/mydb/non-existent-doc' },
  headers:
  { 'x-couchdb-body-time': '0',
    'x-couch-request-id': '1c16b2b81f',
    'transfer-encoding': 'chunked',
    etag: '"7Q4MT2X8W1RO3JQOLSA4KGMV7"',
    date: 'Fri, 27 Apr 2018 08:49:26 GMT',
    'content-type': 'application/json',
    'cache-control': 'must-revalidate',
    statusCode: 404,
    uri: 'https://example.cloudant.com/mydb/non-existent-doc' },
  errid: 'non_200',
  description: 'couch returned 404' }
```

As shown above, the corresponding database `request`, `headers` and `statusCode`
are also returned in the error.

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

Note that the `statusCode` and `uri` and also included amongst the response
headers.

### Request Plugins

The library is easily extendable via the use of plugins. They provide the
ability to intercept a request:

1. Before the request is submitted to the server.
2. After the response headers are received.
3. If the underlying HTTP client emits an `error` event.

Plugins can be used to modify an outgoing request, edit an incoming response or
even retry a request entirely.

#### Plugin Configuration

The `maxAttempt` is a global configuration that applies to all plugins. It's the
maximum number of times the request will be attempted _(default: 3)_.

All other configuration is plugin specific. It must be passed within an object
to the `plugins` parameter in the client constructor. For example:

```js
var cloudant = Cloudant({ url: myurl, maxAttempt: 5, plugins: [ { iamauth: { iamApiKey: 'abcxyz' } }, { retry: { retryDelayMultiplier: 4 } } ]);
```

`maxAttempt` can _not_ be overridden by plugin specific configuration.

#### The Plugins

1. `cookieauth`

   If there is no plugin specified this will be the default plugin.

   This plugin will automatically exchange your Cloudant credentials for a
   cookie. It will handle the authentication and ensure that the cookie is
   refreshed as required.

   For example:
   ```js
   var cloudant = Cloudant({ url: myurl, username: username, password: password, plugins: 'cookieauth' });
   ```

   The plugin will transparently call `POST /_session` to exchange your
   credentials for a cookie before proceeding with the document fetch.

   Note that all subsequent requests made using this client will also use cookie
   authentication. The library will automatically refresh the cookie on any
   `401` or `403` response.

   If you don't specify a username and password during the client construction
   then cookie authentication is disabled.

   You can turn off automatically refreshing cookie with the following configuration:
   ```js
   var cloudant = Cloudant({ url: myurl, username: username, password: password, plugins: [ { cookieauth: { autoRenew: false } } ] });
   ```

2. `iamauth`

   IBM Cloud Identity & Access Management enables you to securely authenticate
   users and control access to all cloud resources consistently in the IBM
   Cloud Platform.

   This plugin will automatically exchange your IAM API key for a token. It will
   handle the authentication and ensure that the token is refreshed as required.

   For example:
   ```js
   var cloudant = Cloudant({ url: myurl, plugins: { iamauth: { iamApiKey: 'xxxxxxxxxx' } } });
   ```

   The production IAM token service at https://iam.cloud.ibm.com/identity/token is
   used by default. You can set `iamTokenUrl` in your plugin configuration to
   override this. To authenticate with the IAM token service set `iamClientId`
   and `iamClientSecret` in your plugin configuration.

   The plugin will retry failed requests to the token service (specifically
   `429` and `5xx` responses) until the number of retry requests reaches
   `maxAttempt`. Be aware that retrying requests to the token service delays the
   client request. It also increases the number of token exchange attempts and
   therefore may result in rate limiting by the IAM token service.

   If the IAM token cannot be retrieved after the configured number of retries
   (either because the IAM token service is down or the IAM API key is
   incorrect) then an error is returned to the client.

   See [IBM Cloud Identity and Access Management](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-work-with-your-account#authentication-iam) for more information.

   You can turn off automatically refreshing token with the following configuration:
   ```js
   var cloudant = Cloudant({ url: myurl, plugins: [ { iamauth: { iamApiKey: 'xxxxxxxxxx', autoRenew: false } } ] });
   ```

3. `retry`

   This plugin will retry requests on error (e.g. connection reset errors) or on
   a predetermined HTTP status code response using an exponential back-off.

   For example, Cloudant may reply with an HTTP 429 response because you've
   exceed the number of API requests in a given amount of time. You can ensure
   these requests are suitably retried:

   ```js
   var cloudant = Cloudant({ url: myurl, maxAttempt: 5, plugins: { retry: { retryErrors: false, retryStatusCodes: [ 429 ] } } });
   ```

   The plugin has the following configuration options:

    - `retryDelayMultiplier`

      The multiplication factor used for increasing the timeout after each
      subsequent attempt _(default: 2)_.

    - `retryErrors`

      Automatically retry a request on error (e.g. connection reset errors)
      _(default: true)_. Note that this will only retry errors encountered
      _before_ the library starts to read response body data. After that point
      any errors (e.g. socket timeout reading from the server) will be returned
      to the caller (via callback or emitted `error` depending on the usage). 

    - `retryInitialDelayMsecs`

      The initial retry delay in milliseconds _(default: 500)_.

    - `retryStatusCodes`

      A list of HTTP status codes that should be retried _(default: 429, 500,
      501, 502, 503, 504)_.

#### Using Multiple Plugins

You can pass the plugins as an array, for example:
```js
var cloudant = Cloudant({ url: myurl, plugins: [ 'cookieauth', { retry: { retryDelayMultiplier: 4 } } ] });
```

The plugins are _always_ executed in the order they are specified. Remember that
all plugins are respected. If one requests a retry then it cannot be overruled
by another. If two plugins request different delay times before the next retry
attempt then the largest delay time is honoured.

Be aware that if you don't specify any plugins then the `cookieauth` plugin will
automatically be added. To disable all plugins you can pass an empty array as
the plugin list, i.e. `Cloudant({ url: myurl, plugins: [] })`.

## API Reference

Cloudant is a wrapper around the Nano library and as such, Nano's documentation
should be consulted for:

- [Database functions](https://github.com/apache/couchdb-nano#database-functions)
- [Document functions](https://github.com/apache/couchdb-nano#document-functions)
- [Multipart functions](https://github.com/apache/couchdb-nano#multipart-functions)
- [Attachment functions](https://github.com/apache/couchdb-nano#attachments-functions)
- [View and Design functions](https://github.com/apache/couchdb-nano#views-and-design-functions)

This library adds documentation for the following:

- [Authorization and Cloudant API Keys](#authorization-and-cloudant-api-keys)
  - [Generate a Cloudant API key](#generate-a-cloudant-api-key)
  - [Use a Cloudant API Key](#use-a-cloudant-api-key)
- [CORS](#cors)
- [Cloudant Query](#cloudant-query)
- [Cloudant Search](#cloudant-search)
- [Cloudant Geospatial](#cloudant-geospatial)
- [Advanced Features](#advanced-features)
  - [Advanced Configuration](#advanced-configuration)
  - [Pool size and open sockets](#pool-size-and-open-sockets)
  - [Extending the Cloudant Library](#extending-the-cloudant-library)

## Authorization and Cloudant API Keys

Cloudant API keys are part of the legacy access controls. They are different from
the access control mechanisms offered by IBM Cloud IAM. See
[here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-work-with-your-account#api-keys)
for more details.

This feature interfaces with the Cloudant [authorization API][Authorization].

Use the authorization feature to generate new Cloudant API keys to access your
data. A Cloudant API key is basically a username/password pair for granting
others access to your data, without giving them the keys to the castle.

### Generate a Cloudant API key

~~~ js
var Cloudant = require('@cloudant/cloudant');
var url = process.env.cloudant_url;
var username = process.env.cloudant_username;
var password = process.env.cloudant_password;
var cloudant = Cloudant({ url: url, username: username, password:password });

cloudant.generate_api_key(function(err, api) {
  if (err) {
    throw err; // You probably want wiser behavior than this.
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

  var db = cloudant.db.use(db);
  db.set_security(security, function(err, result) {
    if (err) {
      throw err;
    }

    console.log('Set security for ' + db);
    console.log(result);
    console.log('');

    // Or you can read the security settings from a database.
    db.get_security(function(err, result) {
      if (err) {
        throw err;
      }

      console.log('Got security for ' + db);
      console.log(result);
    });
  });
});
~~~

_Output:_

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

### Use a Cloudant API Key

To use a Cloudant API key, initialize a new Cloudant connection, and provide an
additional "key" option when you initialize Cloudant. This will connect to your
account, but using the "key" as the authenticated user. (And of course, use the
appropriate password associated with the Cloudant API key.)

~~~ js
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({ url: url, key:api.key, password:api.password });
~~~

## CORS

You must enable Cross-Origin Resource Sharing (CORS) to access your Cloudant
database from a web application that is served from a domain other than your
Cloudant account.

- To enable CORS from any domain:
  ~~~ js
  cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: [ '*' ]}).then((data) => {
    // success - response is in 'data'.
  }).catch((err) => {
    // failure - error information is in 'err'.
  });
  ~~~

- To enable access from a list of specified domains:
  ~~~ js
  cloudant.set_cors({ enable_cors: true, allow_credentials: true, origins: [ 'https://example.com', 'https://www.example.com' ]}).then((data) => {
    // success - response is in 'data'.
  }).catch((err) => {
    // failure - error information is in 'err'.
  });
  ~~~

- To disable CORS access:
  ~~~ js
  cloudant.set_cors({ enable_cors: false, origins: [] }).then((data) => {
    // success - response is in 'data'.
  }).catch((err) => {
    // failure - error information is in 'err'.
  });
  ~~~

- To fetch the current CORS configuration:
  ~~~ js
  cloudant.get_cors().then((data) => {
    // success - response is in 'data'.
  }).catch((err) => {
    // failure - error information is in 'err'.
  });
  ~~~

See [CORS] for further details.

## Cloudant Query

This feature interfaces with Cloudant's query functionality. See the [Cloudant
Query documentation][Cloudant Query] for details.

As with Nano, when working with a database (as opposed to the root server), run
the `.db.use()` method.

~~~ js
var db = cloudant.db.use('my_db')
~~~

To see all the indexes in a database, call the database `.index()` method with a callback function.

~~~ js
db.index(function(err, result) {
  if (err) {
    throw err;
  }

  console.log('The database has %d indexes', result.indexes.length);
  for (var i = 0; i < result.indexes.length; i++) {
    console.log('  %s (%s): %j', result.indexes[i].name, result.indexes[i].type, result.indexes[i].def);
  }

  result.should.have.a.property('indexes').which.is.an.Array;
  done();
});
~~~

_Output:_

    The database has 3 indexes
      _all_docs (special): {"fields":[{"_id":"asc"}]}
      first-name (json): {"fields":[{"name":"asc"}]}
      last-name (json): {"fields":[{"name":"asc"}]}

To create an index, use the same `.index()` method but with an extra initial
argument: the index definition. For example, to make an index on middle names in
the data set:

~~~ js
var first_name = { name:'first-name', type:'json', index:{fields:['name'] }}
db.index(first_name, function(err, response) {
  if (err) {
    throw err;
  }

  console.log('Index creation result: %s', response.result);
});
~~~

_Output:_

    Index creation result: created

To query using the index, use the `.find()` method.

~~~ js
db.find({ selector: { name:'Alice' } }, function(err, result) {
  if (err) {
    throw err;
  }

  console.log('Found %d documents with name Alice', result.docs.length);
  for (var i = 0; i < result.docs.length; i++) {
    console.log('  Doc id: %s', result.docs[i]._id);
  }
});
~~~

## Cloudant Search

This feature interfaces with Cloudant's search functionality. See the [Cloudant
Search documentation][Cloudant Search] for details.

First, when working with a database (as opposed to the root server), run the
`.use()` method.

~~~ js
var db = cloudant.db.use('my_db')
~~~

In this example, we will begin with some data to search: a collection of books.

~~~ js
var books = [
  { author:"Charles Dickens", title:"David Copperfield" },
  { author:"David Copperfield", title:"Tales of the Impossible" },
  { author:"Charles Dickens", title:"Great Expectation" }
]

db.bulk({ docs:books }, function(err) {
  if (err) {
    throw err;
  }

  console.log('Inserted all documents');
});
~~~

To create a Cloudant Search index, create a design document the normal way you
would with Nano, the database `.insert()` method.

To see all the indexes in a database, call the database `.index()` method with a
callback function.

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

db.insert(ddoc, function (err, result) {
  if (err) {
    throw err;
  }

  console.log('Created design document with books index');
});
~~~

To query this index, use the database `.search()` method. The first argument is
the design document name, followed by the index name, and finally an object with
your search parameters.

~~~ js
db.search('library', 'books', { q: 'author:dickens' }, function(err, result) {
  if (err) {
    throw err;
  }

  console.log('Showing %d out of a total %d books by Dickens', result.rows.length, result.total_rows);
  for (var i = 0; i < result.rows.length; i++) {
    console.log('Document id: %s', result.rows[i].id);
  }
});
~~~

## Cloudant Geospatial

This feature interfaces with Cloudant's geospatial features. See the [Cloudant
Geospatial documentation][Cloudant Geospatial] for details.

Begin with a database, and insert documents in [GeoJSON
format][geojson]. Documents should have `"type"` set to `"Feature"` and also
`"geometry"` with a valid GeoJSON value. For example:

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

db.bulk({ docs: cities }, function(err) {
  if (err) {
    throw err;
  }

  console.log('Inserted all cities');
});
~~~

To make a spatial index of these documents, create a design document with
`"st_indexes"` populated with a JavaScript indexing function.

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

db.insert(ddoc, function (err, result) {
  if (err) {
    throw err;
  }

  console.log('Created design document with city index');
});
~~~

To query this index, use the database `.geo()` method. The first argument is the
design document name, followed by the index name, and finally an object with
your search parameters.

~~~ js
// Find the city within 25km (15 miles) of Lexington, MA.
var query = {
  lat:42.447222, lon:-71.225,
  radius:25000,
  include_docs:true
};

db.geo('city', 'city_points', query, function(err, result) {
  if (err) {
    throw err;
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

See [here](https://www.typescriptlang.org) for further details.

## Advanced Features

### Partitioned Databases

Partitioned databases introduce the ability for a user to create logical groups
of documents called partitions by providing a partition key with each document.

Ensure your Cloudant cluster has the partitions feature enabled. A full list of
enabled features can be retrieved by calling the Cloudant `ping()` method.

```js
cloudant.ping().then((body) => { console.log(body.features_flags) })
// [ 'partitioned' ]
```

**Creating a partitioned database**

```js
await cloudant.db.create('my-partitioned-db', { partitioned: true })
// { ok: true }
```

**Handling documents**

The document ID contains both the partition key and document key in the form
`<partitionkey>:<documentkey>` where:

- Partition Key *(string)*. Must be non-empty. Must not contain colons (as this
  is the partition key delimiter) or begin with an underscore.
- Document Key *(string)*. Must be non-empty. Must not begin with an underscore.

Be aware that `_design` documents and `_local` documents must not contain a
partition key as they are global definitions.

*Create a document*

```js
// document to add
const doc = { _id: 'canidae:dog', name: 'Dog', latin: 'Canis lupus familiaris' }

// insert the document
await db.insert(doc)
// { "ok": true, "id": "canidae:dog", "rev": "1-3a4c4c5d65709bcb3ec675ec895d4051" }
```

*Get a document*

```js
// fetch a document by its ID
await db.get('canidae:dog')
// { _id: 'canidae:dog', _rev: '1-3a4c4c5d65709bcb3ec675ec895d4051', name: 'Dog', latin: 'Canis lupus familiaris' }
```

**Get partition information**

To fetch the information about a single partition, use the `partitionInfo`
function and pass a partition key:

```js
// get partition information from the 'canidae' partition
await db.partitionInfo('canidae')
// {"db_name":"myhost-bluemix/mypartitioneddb","sizes":{"active":392,"external":332},"partition":"canidae","doc_count":4,"doc_del_count":0}
```

**Get all documents from a partition**

To fetch all of the documents from a partition, use the `partitionedList`
function:

```js
// fetch all documents in the 'canidae' partition, returning document bodies too.
await db.partitionedList('canidae', { include_docs: true })
// { "total_rows": 4, "offset": 0, "rows": [ ... ] }
```

**Partitioned Cloudant Query**

:exclamation: To run partitioned queries the database itself must be partitioned. :exclamation:

*Create a partitioned index*

To create an index that is partitioned, ensure that the `partitioned: true`
field is set when calling the `insert` function, to instruct Cloudant to create
a partitioned query, instead of a global one:

```js
// index definition
const i = {
  ddoc: 'partitioned-query',
  index: { fields: ['name'] },
  name: 'name-index',
  partitioned: true,
  type: 'json'
}

// instruct Cloudant to create the index
await db.index(i)
// { result: 'created', id: '_design/partitioned-query', name: 'name-index' }
```

*Find within a partition*

To perform a Cloudant Query in a single partition, use the `partitionedFind` (or
`partitionedFindAsStream`) function:

```js
// find document whose name is 'wolf' in the 'canidae' partition
await db.partitionedFind('canidae', { 'selector' : { 'name': 'Wolf' }})
// { "docs": [ ... ], "bookmark": "..." }
```

**Partitioned Search**

:exclamation: To run partitioned searches the database itself must be partitioned. :exclamation:

*Create a partitioned search index*

To create a [Cloudant
Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-search)
index that is partitioned, write a [design
document](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-design-documents)
to the database containing the index definition. Use `options.partitioned =
true` to specify that this is a partitioned index:

```js
// the search definition
const func = function(doc) {
  index('name', doc.name)
  index('latin', doc.latin)
}

// the design document containing the search definition function
const ddoc = {
  _id: '_design/search-ddoc',
  indexes: {
    search-index: {
      index: func.toString()
    }
  },
  options: {
    partitioned: true
  }
}

await db.insert(ddoc)
// { ok: true, id: '_design/search-ddoc', rev: '1-e7257e575d666ca062b4fe0bdeb6fba1' }
```

*Search within a partition*

To perform a [Cloudant
Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-search)
against a pre-existing Cloudant Search index, use the `partitionedSearch`
function:

```js
const params = {
  q: 'name:\'Wolf\''
}
await db.partitionedSearch('canidae', 'search-ddoc', 'search-index', params)
// { total_rows: ... , bookmark: ..., rows: [ ...] }
```

**MapReduce Views**

:exclamation: To run partitioned views the database itself must be partitioned. :exclamation:

*Creating a partitioned MapReduce view*

To create a MapReduce view, ensure the `options.partitioned` flag is set to
`true` to indicate to Cloudant that this is a partitioned rather than a global
view:

```js
const func = function(doc) {
  emit(doc.family, doc.weight)
}

// Design Document
const ddoc = {
  _id: '_design/view-ddoc',
  views: {
    family-weight: {
      map: func.toString(),
      reduce: '_sum'
    }
  },
  options: {
    partitioned: true
  }
}

// create design document
await db.insert(ddoc)
// { ok: true, id: '_design/view-ddoc', rev: '1-a062b4fe0bdeb6fbe7257e575d666ca1' }
```

*Querying a partitioned MapReduce view*

To direct a query to a pre-existing partitioned MapReduce view, use the
`partitionedView` (or `partitionedViewAsStream`) function:

```js
const params = {}
await db.partitionedView('canidae', 'view-ddoc', 'family-weight', params)
// { rows: [ { key: ... , value: [Object] } ] }
```

**Global indexes**

A partitioned database may still have *global* Cloudant Query, Cloudant Search
and MapReduce indexes. Create the indexes as normal but be sure to supply
`false` as the `partitioned` flag, to indicate you need a global index. Then
query your index as normal using `db.find`, `db.search` or `db.view`.

### Debugging

Enable debugging output by setting the following environment variable:

    export DEBUG=cloudant*
    # then run your Node.js application

There are several debuggers used within the library. You can capture output from
a specific debugger. Here are some examples:

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

This will show all HTTP requests and responses made by the library. Be aware
that credentials are also logged.

### Advanced Configuration

Besides the `url`, `username` and `password` options, you can add an optional
`requestDefaults` value, which will initialize Request (the underlying HTTP
library) as you need it.

~~~ js

// Use an HTTP proxy to connect to Cloudant.
var options =
  { "url"         : "https://myaccountid.cloudantnosqldb.appdomain.cloud"
  , "username"    : "myuser"
  , "password"        : "secret"
  , "requestDefaults": { "proxy": "http://localhost:8080" }
  }
var cloudant = require('@cloudant/cloudant')(opts);
// Now using the HTTP proxy...

~~~

Please check [Request][request] for more information on the defaults. They
support features like cookie jar, proxies, ssl, etc.

### TLS 1.2 Support

If your server enforces the use of TLS 1.2 then the nodejs-cloudant client will
continue to work as expected (assuming you're running a version of Node/OpenSSL
that supports TLS 1.2).

### Pool size and open sockets

A very important configuration parameter if you have a high traffic website and
are using Cloudant is setting up the pool size. By default, the nodejs-cloudant
agent is configured to use a maximum of 6 sockets.

You can change the maximum number of sockets by passing a custom agent to
`requestDefaults`.

Here is an example where the agent is configured with a maximum of 50 sockets
and a keep-alive time of 30s:

~~~ js
var protocol = require('https');
var myagent = new protocol.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50
});
var cloudant = require('@cloudant/cloudant')({ url: "https://myaccountid.cloudantnosqldb.appdomain.cloud", username: "myuser", password:"secret", requestDefaults: { agent: myagent } });
// Using Cloudant with myagent...
~~~

For more details, refer to the [Request][request] documentation and examples.

### Extending the Cloudant Library

Cloudant is minimalistic but you can add your own features with
`cloudant.request(opts, callback)`

For example, to create a function to retrieve a specific revision of the `panda`
document:

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

When using the `*AsStream` functions instead of a `Promise` a `request` object
is returned that may be piped as a stream. For example:

```js
cloudant.db.listAsStream()
  .on('error', function(error) {
    console.log('ERROR');
  })
  .on('end', function(error) {
    console.log('DONE');
  })
  .pipe(process.stdout);
```

Note that there are no callbacks when using these streams and event listeners
must be used instead.

## Development and Contribution

This is an open-source library, published under the Apache 2.0 license. We very
much welcome contributions to the project so if you would like to contribute
(even if it's fixing a typo in the README!) simply

* Fork this repository. Visit https://github.com/cloudant/nodejs-cloudant and
  click the "Fork" button.
* Commit changes into your copy of the repository
* When you're ready, create a Pull Request to contribute your changes back into
  this project

If you're not confident about being able to fix a problem yourself, or want to
simply [report an issue](https://github.com/cloudant/nodejs-cloudant/issues)
then please.

### Local Development

To join the effort developing this project, start from our GitHub page:
https://github.com/cloudant/nodejs-cloudant

First clone this project from GitHub, and then install its dependencies using
NPM.

    $ git clone https://github.com/cloudant/nodejs-cloudant
    $ npm install

### Test Suite

We use NPM to handle running the test suite. To run the comprehensive test
suite, just run `npm test`.

You can also run the tests with verbose output using `npm test-verbose`

## Migrating to `cloudant-node-sdk` library
We have a newly supported Cloudant Node.js SDK named [cloudant-node-sdk](https://github.com/IBM/cloudant-node-sdk).
For advice on migrating from this module see [MIGRATION.md](MIGRATION.md).

## License

Copyright (c) 2016 IBM Cloudant, Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.


## Reference

* [Authentication]
* [Authorization]
* [CORS]
* [Cloudant Documentation]
* [Cloudant Query]
* [Cloudant Search]
* [Follow library]
* [Issues]
* [Nano Library]

[Authentication]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-faq-authenticating-cloudant
[Authorization]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-managing-access-for-cloudant
[CORS]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cors
[Cloudant Documentation]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-getting-started-with-cloudant
[Cloudant Geospatial]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-nosql-db-geospatial
[Cloudant Query]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query
[Cloudant Search]: https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-search
[Follow library]: https://github.com/cloudant-labs/cloudant-follow
[Issues]: https://github.com/cloudant/nodejs-cloudant/issues
[Nano Library]: https://github.com/apache/couchdb-nano
[geojson]: http://geojson.org/
[request]: https://github.com/request/request
