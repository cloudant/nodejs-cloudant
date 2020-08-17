# 4.3.0 (2020-08-17)
- [FIXED] Stopped constant token auto renewal in the absence of a cookie
  header Max-Age.
- [UPGRADED] Upgrade package: @types/request@^2.48.4.
- [UPGRADED] Upgrade package: nano@~8.2.2.

# 4.2.4 (2020-03-02)
- [FIXED] Pinned Nano to version 8.1 to resolve issue with extending upstream
  TypeScript changes in Nano version 8.2.0.

# 4.2.3 (2019-12-05)
- [FIXED] Expose BasePlugin.
- [FIXED] Prevent double encoding of credentials passed in URL user information
  when using the `cookieauth` plugin.
- [IMPROVED] Documented the characters that are required to be encoded in URL
  user information.
- [IMPROVED] Documented the legacy compatibility behaviour that always adds the
  `cookieauth` plugin when using the initialization callback functionality.

# 4.2.2 (2019-10-23)
- [FIXED] Stopped disabling the IAM auth plugin after failed IAM
  authentications. Subsequent requests will re-request authorization,
  potentially failing again if the original authentication failure was not
  temporary.
- [FIXED] Ensure IAM API key can be correctly changed.
- [FIXED] Callback with an error when a user cannot be authenticated using IAM.
- [FIXED] Ensure authorization tokens are not unnecessarily requested.
- [IMPROVED] Do not apply cookie authentication by default in the case that no
  credentials are provided.
- [IMPROVED] Preemptively renew authorization tokens that are due to expire.

# 4.2.1 (2019-08-29)
- [FIXED] Include all built-in plugin modules in webpack bundle.

# 4.2.0 (2019-08-27)
- [NEW] Added option to set new IAM API key.
- [FIXED] Allow plugins to be loaded from outside the 'plugins/' directory.
- [FIXED] Retry bad IAM token requests.

# 4.1.1 (2019-06-17)
- [FIXED] Remove unnecessary `npm-cli-login` dependency.

# 4.1.0 (2019-05-14)
- [NEW] Added partitioned database support.

# 4.0.0 (2019-03-12)
- [NEW] Added option for client to authenticate with IAM token server.
- [FIXED] Add `vcapServiceName` configuration option to TS declarations.
- [FIXED] Case where `.resume()` was called on an undefined response.
- [FIXED] Updated the default IAM token server URL.
- [BREAKING CHANGE] Nano 7 accepted a callback to the `*AsStream` functions, but
  the correct behaviour when using the `request` object from `*AsStream`
  functions is to use event handlers. Users of the `*AsStream` functions should
  ensure they are using event handlers not callbacks before moving to this
  version.
- [UPGRADED] Apache CouchDB Nano to a minimum of version 8 for `*AsStream`
  function fixes.

# 3.0.2 (2019-01-07)
- [FIXED] Remove unnecessary `@types/nano` dependancy.

# 3.0.1 (2018-11-22)
- [FIXED] Use named import for `request.CoreOptions` type.

# 3.0.0 (2018-11-20)
- [FIXED] Expose `BasePlugin` type in Cloudant client.
- [FIXED] Set `parseUrl = false` on underlying Nano instance.
- [BREAKING CHANGE] Due to the Nano 7.x upgrade all return types are now a
  `Promise` (except for the `...AsStream` functions). _See
  [api-migration.md](https://github.com/cloudant/nodejs-cloudant/blob/master/api-migration.md#2x--3x)
  for migration details._
- [REMOVED] Remove nodejs-cloudant TypeScript type definitions for
  `db.search`. These definitions are now imported directly from Nano.
- [REMOVED] Removed support for the deprecated Cloudant virtual hosts feature.
- [UPGRADED] Using nano==7.1.1 dependency.

# 2.4.1 (2018-11-12)
- [FIXED] Don't override `plugins` array when instantiating a new client using VCAP.

# 2.4.0 (2018-09-19)
- [FIXED] Case where `username` and `password` options were not used if a `url` was supplied.
- [FIXED] Case where `vcapServices` was supplied with a basic-auth `url`.

# 2.3.0 (2018-06-08)
- [FIXED] Removed addition of `statusCode` to response objects returned by promises.
- [IMPROVED] Added support for IAM API key when initializing client with VCAP_SERVICES environment variable.

# 2.2.0 (2018-04-30)
- [FIXED] Add missing `maxAttempt` parameter to TypeScript definition.
- [FIXED] Include client initialization callback in TypeScript definition.
- [FIXED] Prevent client executing done callback multiple times.
- [FIXED] Removed test and lint data that bloated npm package size.
- [FIXED] Support Cloudant query when using promises request plugin.

# 2.1.0 (2018-03-05)
- [NEW] Add TypeScript definitions.
- [NEW] Allow pipes to be defined inside request event handlers.
- [UPGRADED] Using nano==6.4.3 dependancy.
- [NOTE] Update engines in preparation for Node.js 4 “Argon” end-of-life.

# 2.0.2 (2018-02-14)
- [FIXED] Updated `require` references to use newly scoped package
  `@cloudant/cloudant`.

# 2.0.1 (2018-02-14)
- [NEW] Added API for upcoming IBM Cloud Identity and Access Management support
  for Cloudant on IBM Cloud. Note: IAM API key support is not yet enabled in the
  service.
- [NEW] Support multiple plugins.
  _See [api-migration.md](https://github.com/cloudant/nodejs-cloudant/blob/master/api-migration.md)
  for migration details._
- [NEW] Allow use of a custom service name from the CloudFoundry VCAP_SERVICES
  environment variable.
- [FIXED] Fix `get_security`/`set_security` asymmetry.
- [FIXED] Support piping of request payload with plugins.
- [BREAKING CHANGE] Replace `retryAttempts` option with `maxAttempts`. This
  defines the maximum number of times the request will be attempted.
- [BREAKING CHANGE] By default the `retry` plugin will retry requests on HTTP
  429 status codes, a subset of 5xx server error status codes and also TCP/IP
  errors.
  _See [api-migration.md](https://github.com/cloudant/nodejs-cloudant/blob/master/api-migration.md)
  for migration details._
- [BREAKING CHANGE] Changed `promise` plugin to throw new `CloudantError` (not
  `string`).
- [REMOVED] Remove global `retryTimeout` option (replaced by plugin specific
  configuration).
- [REMOVED] Remove previously deprecated method `set_permissions`.
- [IMPROVED] Updated documentation by replacing deprecated Cloudant links with
  the latest bluemix.net links.

# 1.10.0 (2017-11-01)
- [UPGRADED] Upgrade package: cloudant-nano@6.7.0.

# 1.9.0 (2017-10-20)
- [NEW] Add 'error' & 'response' events to 429 retry plugin stream.
- [FIXED] `{silent: true}` to dotenv to prevent `.env` warnings.
- [UPGRADED] Upgrade package: cloudant-nano@6.6.0.
- [UPGRADED] Upgrade package: debug@^3.1.0.
- [UPGRADED] Upgrade package: request@^2.81.0.

# 1.8.0 (2017-05-23)
- [UPGRADED] Using cloudant-nano==6.5.0 dependancy.
