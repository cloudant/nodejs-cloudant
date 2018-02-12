# Soak Tests
These tests are designed to simulate typical production load, over a continuous availability period, to validate system behavior under production use.

## Running
The tests run against a Cloudant account, namely `https://$cloudant_username.cloudant.com`. Ensure the `cloudant_username` and `cloudant_password` environment variables have been set. These credentials must have admin privileges as during each test run a new database will be created and subsequently deleted.

Run the tests from inside the `soak_test` directory, for example:
```sh
$ export cloudant_username=username
$ export cloudant_password=pa55w0rd01
$ export max_runs=10
$ node soak.js
  test:soak Starting test... +2ms
  test:soak [TEST RUN] Using database 'nodejs-cloudant-838a0824-a9f3-4fff-825b-e08842ee4a0d'. +10ms
  test:soak [TEST RUN] Using database 'nodejs-cloudant-7c49cca6-e916-41b3-a651-ab2a7810f743'. +57s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-05a0d613-1de9-4c0e-aca4-a2655695def2'. +52s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-31950f8b-a851-4228-bfbf-2cc22bfff888'. +49s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-fcfd1378-b594-4552-b26a-d30d2f0457da'. +52s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-690a3524-ff37-41e2-858d-577db2fb6d2a'. +54s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-d81f9047-cd6f-4ee7-87da-c266182d1cc6'. +51s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-b776fc14-b6c6-44ea-a9aa-4dafa4865077'. +53s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-4add7454-41d4-4ecf-a5b3-454a823de868'. +51s
  test:soak [TEST RUN] Using database 'nodejs-cloudant-0734f2b0-409c-489e-8a17-7745e954d691'. +55s
  test:soak All tests passed successfully. +56s
$ echo $?
0
```
Test runs are executed in series by default. You can parallelize execution by setting the `concurrency` environment variable.
By default, a total of 100 test runs will be executed. The `max_runs` environment variable can be set to override this _(shown above)_.

Each test run _should_ complete in under 60 seconds when executed in series over a "good" network connection (i.e. >20Mb/s download/upload).

## The Tests
Each test run performs the following actions:
* `HEAD /` - Ping the root URL.
* `PUT /<db>` - Create a new database.
* `GET /<db>` - Get the database metadata.
* `GET /<db>/_security` - Get the database security object.
* `POST /<db>/<doc>` - Post a new document to the database.
* `GET /<db>` - Get the database metadata.
* `GET /<db>/<doc>` - Retrieve a document from the database.
* `DELETE /<db>/<doc>` - Delete a document from the database.
* `POST /<db>/_bulk_docs` - Upload multiple documents via the bulk API.
* `GET /<db>` - Get the database metadata.
* `GET /<db>/_changes` - Get the database change log and save to a file.
* `GET /<db>/<doc>` - Retrieve 1,234 documents (using concurrency 10).
* `POST /<db>/_bulk_docs` - Upload multiple documents via the bulk API.
* `POST /<db>/<doc>` - Post 1,234 new documents (using concurrency 10).
* `GET /<db>` - Get the database metadata.
* `DELETE /<db>` - Delete the database.

Two separate clients are used throughout the test. One uses the builtin `promises` plugin, the other does not. Assertions are made during each test run to ensure all server responses are valid and the database state is as expected. Any assertion failures will cause the tests to terminate early with exit code 1.
