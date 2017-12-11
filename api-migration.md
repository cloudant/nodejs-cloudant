# Migrating to new APIs

This document covers migrating your code when a nodejs-cloudant major release
has breaking API changes. Each section covers migrating from one major version
to another. The section titles state the versions between which the change was
made.

## 1.x → 2.x

This change introduces multiple plugin support by using a request interceptor
pattern. All existing plugins included with this library have been rewritten
to support the new implementation.

The library continues to support legacy plugins. They can be used in conjunction
with new plugins. Your plugins list may contain any number of new plugins but
only ever one legacy plugin.

The `cloudant.request` object is a pass through stream and cannot be used inside
an event hook function. For example:

```js
var cloudant = new Cloudant({ url: myUrl, plugins: [ 'retry429', 'retryerror' ] });

// make a custom request
var r = cloudant.request({ path: '_all_dbs' })
  .on('response', function(resp) {
    if (resp.statusCode === 200) {
      r.pipe(process.stdout); // this doesn't work!
      resp.pipe(process.stdout); // this does work!
    }
  });

r.pipe(process.stdout); // this does work!
```

The final response isn't returned to the client until all the plugin hooks have
been executed. This means that any pipe on the `cloudant.request` object must be
in place _before_ the `response` event is triggered (as shown above).

Cookie authentication is enabled by default if no plugins are specified.
Note that if you wish to use cookie authentication alongside other plugins you
will need to include `cookieauth` in your plugins list. If you wish to disable
all plugins then pass an empty array to the `plugins` parameter during
construction.
