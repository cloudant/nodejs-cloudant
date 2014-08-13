## Notes

Validation of queries, of valid arguments, etc? Put on the 1.1 feature list?

Rather than supply a full URL, do we just ask for your username?

Should we permit plaintext HTTP? Should we permit it for unauthenticated requests but not for authenticated ones?

Audit all the code where users have to specify "_design/foo" in some places but just "foo" in others (e.g. db.search).

I do not like the synchronous `.use()` function in Nano. First of all, being synchronous makes it a rarity. But also, basically it is just appending a string in memory, making a "namespace"; however, that is a good opportunity to reach out and confirm
1. That the database exists
2. That it can be read by us (in other words, if it exists but we are not authorized, we would not want that error to show up when we try to write a document, but earler)

## Differences with CouchDB

* http://docs.cloudant.com/api/authz.html
  * `set_permissions`
  * `generate_api_key`
* http://docs.cloudant.com/api/database.html
  * `_shards`
* http://docs.cloudant.com/api/documents.html
  * Read quorum: http://docs.cloudant.com/api/documents.html#overriding-the-default-read-quorum
  * Write quorum: http://docs.cloudant.com/api/documents.html#overriding-the-default-write-quorum
* http://docs.cloudant.com/api/search.html - The entire thing
* http://docs.cloudant.com/api/cloudant-query.html - The entire thing
* http://docs.cloudant.com/api/misc.html
  * `_membership`
* http://bigcouch.cloudant.com/api
  * Remove `_restart`
  * Perhaps do validation to disallow local databases with `_replicate`
  * No `_stats`
  * No `_compact`
  * Testing update sequence format changes
  * No `_purge`
  * No temporary views
  * No `all_or_nothing`

## Questions

Should the library enforce mandatory https? What if plaintext http required a lesser-used option?

Should the library enforce mandatory authenticated connections? What if anonymous connections required a lesser-used option?

Maybe if they specify a callback during setup, we will ping the server for them.
