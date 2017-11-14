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

Cookie authentication is enabled by default if no plugins are specified.
Note that if you wish to use cookie authentication alongside other plugins you
will need to include `cookieauth` in your plugins list. If you wish to disable
all plugins then pass an empty array to the `plugins` parameter during
construction.
