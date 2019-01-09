# Migrating to new APIs

This document covers migrating your code when a nodejs-cloudant major release
has breaking API changes. Each section covers migrating from one major version
to another. The section titles state the versions between which the change was
made.

## 3.x → 4.x

[Apache CouchDB Nano](https://www.npmjs.com/package/nano) version 7 used in
`nodejs-cloudant` 3.x had an API error that allowed specifying a callback when
using `*AsStream` functions. Using a callback with the `request` object caused a
`Buffer` allocation attempt for the entire response size, which would fail for
large streams. The correct approach is to use event listeners on the response
stream.

To prevent incorrect usage the option of providing a callback was removed from
the Apache CouchDB Nano API in version 8 and consequently nodejs-cloudant 4.x.
Consumers of the `*AsStream` functions using callbacks need to adapt their code
to use event listeners instead. For example:

```js
cloudant.db.listAsStream(function(error, response, body) {
  if (error) {
    console.log('ERROR');
  } else {
    console.log('DONE');
  }
}).pipe(process.stdout);
```

may be replaced with:

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

## 2.x → 3.x

We've upgraded our [nano](https://www.npmjs.com/package/nano) dependency. This
means all return types are now a `Promise` (except for the `...AsStream`
functions). The `promise` plugin is no longer required. It is silently ignored
when specified in the client configuration.

Example:
```js
var cloudant = new Cloudant({ url: myUrl, plugins: [ 'retry' ] });

// Lists all the databases.
cloudant.db.list().then((dbs) => {
  dbs.forEach((db) => {
    console.log(db);
  });
}).catch((err) => { console.log(err); });
```

Nano is responsible for resolving or rejecting all promises. Any errors thrown
are created from within Nano. The old `CloudantError` type no longer exists.

## 1.x → 2.x

This change introduces multiple plugin support by using a request interceptor
pattern. All existing plugins included with this library have been rewritten
to support the new implementation.

Plugins must be passed via the `plugins` parameter in the Cloudant client
constructor (formerly known as `plugin`).

The library continues to support legacy plugins. They can be used in conjunction
with new plugins. Your plugins list may contain any number of new plugins but
only ever one legacy plugin.

If you were using the 429 `retry` plugin in version 1.x then be aware that
the configuration has now changed. The new plugin retries 429 and 5xx HTTP
status codes as well as any request errors (such as connection reset errors).

Example:
- __Old__ plugin configuration:
  ```js
  var cloudant = new Cloudant({ url: myUrl, plugin: 'retry', retryAttempts: 5, retryTimeout: 1000 });
  ```
- __New__ plugin configuration _(to mimic 1.x 429 `retry` behavior)_:
  ```js
  var cloudant = new Cloudant({ url: myUrl, maxAttempt: 5, plugins: { retry: { retryDelayMultiplier: 1, retryErrors: false, retryInitialDelayMsecs: 1000, retryStatusCodes: [ 429 ] } } });
  ```
  Or simply use the `retry` defaults (specified [here](https://github.com/cloudant/nodejs-cloudant#the-plugins)):
  ```js
  var cloudant = new Cloudant({ url: myUrl, maxAttempt: 5, plugins: 'retry' });
  ```

Cookie authentication is enabled by default if no plugins are specified.

Note that if you wish to use cookie authentication alongside other plugins you
will need to include `cookieauth` in your plugins list. If you wish to disable
all plugins then pass an empty array to the `plugins` parameter during
construction (see below).

```js
var cloudant = new Cloudant({ url: myUrl, plugins: [] });
```

Finally, the `promise` plugin now throws a `CloudantError` (extended from
`Error`) rather than a `string` which was considered bad practice.
