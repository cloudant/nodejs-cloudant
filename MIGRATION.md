# Migrating to the `cloudant-node-sdk` library
This document is to assist in migrating from the `nodejs-cloudant` (package: `@cloudant/cloudant`) to the newly supported [`cloudant-node-sdk`](https://github.com/IBM/cloudant-node-sdk) (package: `@ibm-cloud/cloudant`) that compatible with JavaScript and TypeScript.

## Initializing the client connection
There are several ways to create a client connection in `cloudant-node-sdk`:
1. [Environment variables](https://github.com/IBM/cloudant-node-sdk#authentication-with-environment-variables)
2. [External configuration file](https://github.com/IBM/cloudant-node-sdk#authentication-with-external-configuration)
3. [Programmatically](https://github.com/IBM/cloudant-node-sdk#programmatic-authentication)

[See the README](https://github.com/IBM/cloudant-node-sdk#code-examples) for code examples on using environment variables.

## Other differences
1. Using the `dotenv` package to store credentials in a file is not recommended. See the [external file configuration section](https://github.com/IBM/cloudant-node-sdk#authentication-with-external-configuration) in our API docs for handling this feature in our new library.
1. Fetching the database object first before performing additional operations is not required. For example, in the case of updating a document you would first call `getDocument` to fetch and then `putDocument` to update.
1. Plugins are not supported, but several of the plugin features exist in the new library e.g. IAM.
1. The plugin for retrying failed requests is not supported.

## Request mapping
Here's a list of the top 5 most frequently used `nodejs-cloudant` operations and the `cloudant-node-sdk` equivalent API operation documentation link:

| `nodejs-cloudant` operation | `cloudant-node-sdk` API operation documentation link |
|-----------------------------|---------------------------------|
|`db.get()`                   |[`getDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#getdocument)|
|`db.view()`                  |[`postView`](https://cloud.ibm.com/apidocs/cloudant?code=node#postview)|
|`db.find()`                  |[`postFind`](https://cloud.ibm.com/apidocs/cloudant?code=node#postfind)|
|`db.head()`                  |[`headDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#headdocument)|
|`db.insert()`                |[`putDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#putdocument)|

[A table](#reference-table) with the whole list of operations is provided at the end of this guide.

The `cloudant-node-sdk` library is generated from a more complete API spec and provides a significant number of operations that do not exist in `nodejs-cloudant`. See [the IBM Cloud API Documentation](https://cloud.ibm.com/apidocs/cloudant) to review request parameter and body options, code examples, and additional details for every endpoint.

## Known Issues
There's an [outline of known issues](https://github.com/IBM/cloudant-node-sdk/blob/master/KNOWN_ISSUES.md) in the `cloudant-node-sdk` repository.

## Reference table
The table below contains a list of `nodejs-cloudant` functions and the `cloudant-node-sdk` equivalent API operation documentation link.  The `cloudant-node-sdk` operation documentation link will contain the new function in a code sample e.g. `getServerInformation` link will contain a code example with `getServerInformation()`.

**Note:** There are many API operations included in the new `cloudant-node-sdk` that are not available in the `nodejs-cloudant` library. The [API documentation](https://cloud.ibm.com/apidocs/cloudant?code=node) contains the full list of operations.

|nodejs-cloudant function | cloudant-node-sdk function reference |
|-------------------------|--------------------------------------|
|`ping()`|[getServerInformation ](https://cloud.ibm.com/apidocs/cloudant?code=node#getserverinformation)|
|`listDbs()/listDbsAsStream()`|[getAllDbs](https://cloud.ibm.com/apidocs/cloudant?code=node#getalldbs)|
|`updates()/followUpdates()`|[getDbUpdates](https://cloud.ibm.com/apidocs/cloudant?code=node#getdbupdates)|
|`replicate()`/`replicateDb()`|[`postReplicate`](https://cloud.ibm.com/apidocs/cloudant?code=node#postreplicate)|
|`enableReplication()`/`replication.enable()`|[`putReplicationDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#putreplicationdocument)|
|`queryReplication()`/`replication.query()`|[`getSchedulerDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#getschedulerdocument)|
|`disableReplication()`/`replication.delete()`|[`deleteReplicationDocument`](https://cloud.ibm.com/apidocs/cloudant?code=node#deletereplicationdocument)|
|`session()`|[getSessionInformation](https://cloud.ibm.com/apidocs/cloudant?code=node#getsessioninformation)|
|`uuids()`|[getUuids](https://cloud.ibm.com/apidocs/cloudant?code=node#getuuids)|
|`db.destroy()`|[deleteDatabase](https://cloud.ibm.com/apidocs/cloudant?code=node#deletedatabase)|
|`db.info()`|[getDatabaseInformation](https://cloud.ibm.com/apidocs/cloudant?code=node#getdatabaseinformation)|
|`db.insert()`|[postDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#postdocument)|
|`db.create(db_name)`|[putDatabase](https://cloud.ibm.com/apidocs/cloudant?code=node#putdatabase)|
|`db.fetch()/db.list()/db.listAsStream()`|[postAllDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postalldocs)|
|`db.bulk()`|[postBulkDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postbulkdocs)|
|`db.bulk_get()`|[postBulkGet](https://cloud.ibm.com/apidocs/cloudant?code=node#postbulkget)|
|`db.changes()`|[postChanges](https://cloud.ibm.com/apidocs/cloudant?code=node#postchanges)|
|`db.destroy() with _design path`|[deleteDesignDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#deletedesigndocument)|
|`db.get() with _design path`|[getDesignDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#getdesigndocument)|
|`db.insert() with _design path`|[putDesignDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#putdesigndocument)|
|`db.search()/db.searchAsStream()`|[postSearch](https://cloud.ibm.com/apidocs/cloudant?code=node#postsearch)|
|`db.view()`|[postView](https://cloud.ibm.com/apidocs/cloudant?code=node#postview)|
|`db.list() (with a filter)`|[postDesignDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postdesigndocs)|
|`db.find()`|[postFind](https://cloud.ibm.com/apidocs/cloudant?code=node#postfind)|
|`db.createIndex()`|[postIndex](https://cloud.ibm.com/apidocs/cloudant?code=node#postindex)|
|`db.index.del()`|[deleteIndex](https://cloud.ibm.com/apidocs/cloudant?code=node#deleteindex)|
|`db.destroy() with _local path`|[deleteLocalDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#deletelocaldocument)|
|`db.get() with _local path`|[getLocalDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#getlocaldocument)|
|`db.insert() with _local path`|[putLocalDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#putlocaldocument)|
|`db.partitionInfo()`|[getPartitionInformation](https://cloud.ibm.com/apidocs/cloudant?code=node#getpartitioninformation)|
|`db.partitionedList()/partitionedListAsStream()`|[postPartitionAllDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postpartitionalldocs)|
|`db.partitionedSearch()/partitionedSearchAsStream()`|[postPartitionSearch](https://cloud.ibm.com/apidocs/cloudant?code=node#postpartitionsearch)|
|`db.partitionedView()/partitionedViewAsStream()`|[postPartitionView](https://cloud.ibm.com/apidocs/cloudant?code=node#postpartitionview)|
|`db.partitionedFind()/partitionedFindAsStream()`|[postPartitionFind](https://cloud.ibm.com/apidocs/cloudant?code=node#postpartitionfind)|
|`db.get_security()`|[getSecurity](https://cloud.ibm.com/apidocs/cloudant?code=node#getsecurity)|
|`db.set_security()`|[putSecurity](https://cloud.ibm.com/apidocs/cloudant?code=node#putsecurity)|
|`db.destroy()`|[deleteDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#deletedocument)|
|`db.get()`|[getDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#getdocument)|
|`db.head()`|[headDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#headdocument)|
|`db.insert()`|[putDocument](https://cloud.ibm.com/apidocs/cloudant?code=node#putdocument)|
|`db.attachment.destroy()`|[deleteAttachment](https://cloud.ibm.com/apidocs/cloudant?code=node#deleteattachment)|
|`db.attachment.get/getAsStream`|[getAttachment](https://cloud.ibm.com/apidocs/cloudant?code=node#getattachment)|
|`db.attachment.insert/insertAsStream`|[putAttachment](https://cloud.ibm.com/apidocs/cloudant?code=node#putattachment)|
|`generate_api_key()`|[postApiKeys](https://cloud.ibm.com/apidocs/cloudant?code=node#postapikeys)|
|`db.set_security()`|[putCloudantSecurityConfiguration](https://cloud.ibm.com/apidocs/cloudant?code=node#putcloudantsecurity)|
|`get_cors()`|[getCorsInformation](https://cloud.ibm.com/apidocs/cloudant?code=node#getcorsinformation)|
|`set_cors()`|[putCorsConfiguration](https://cloud.ibm.com/apidocs/cloudant?code=node#putcorsconfiguration)|
|`db.geo()`|[getGeo](https://cloud.ibm.com/apidocs/cloudant?code=node#getgeo)|
