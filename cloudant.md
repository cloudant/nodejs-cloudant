# Cloudant Node.js Client

This is an alpha version of the Cloudant Node.js client.

## Project Status

This client supports the following features:

* Everything that Apache CouchDB can do (which is a lot)
* [Cloudant Query][query]
* [Cloudant Search][search] using Lucene
* [Authorization][auth], i.e. creating API keys and restricting access
* A helpful `.ping()` method, which will
  1. Confirm that the server is up and that you can connect
  2. Provide you with server information such as the software version
  3. Provide you with information about your own authorization, such as the roles to which you belong

## Getting Started

The best way to use the Cloudant client is to begin with your own Node.js project, and define this work as your dependency. In other words, put me in your package.json dependencies. The `npm` tool can do this for you, from the command line:

    $ npm install --save "git+ssh://git@github.com:cloudant/nodejs-cloudant.git#master"

Notice that your package.json will now reflect this GitHub link. Everyting is working if you can run this command with no errors:

    $ node -e 'require("cloudant"); console.log("Cloudant works");'
    Cloudant works

## Resources

First of all, the Cloudant client is based on the excellent open source CouchDB client, [Nano][nano]. Nano has extensive documentation, so it is a great place to learn most of what you need.

The rest of this document focuses on Cloudant-specific features, and describes the differences from Nano.

To begin, in any file which you will use this code, start by "requiring" it.

```js
var Cloudant = require('cloudant')
```

## Initialization

Initialize your Cloudant connection by supplying your *account* and *password*, and supplying a callback function to run when eveything is ready.

```js
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
```

Output:

    Connected to cloudant
    Server version = 1.0.2
    I am jhs and my roles are ["_admin","_reader","_writer"]
    All my databases: example_db, jasons_stuff, scores

Notes:

* Upper-case `Cloudant` is the package you required, while lower-case `cloudant` represents an authenticated, confirmed connection to your Cloudant service. If you have a better suggestion, let me know or [submit an issue][issues].
* The `.ping()` call is for clarity. In fact, when you initialize your conneciton, you implicitly ping Cloudant, and the "pong" value is passed to you as an optional extra argument: `Cloudant({account:"A", password:"P"}, function(er, cloudant, pong_reply) { ... })`
* To use this code as-is, you must first type ` export cloudant_password="<whatever>"` in your shell. This is inconvenient, and you can invent your own alternative technique; but **DO NOT hard-code your password and commit it to Git**. Storing your password directly in your source code (even in old, long-deleted commits) is a serious security risk to your data. Whoever gains access to your software will now also have access read, write, and delete permission to your data. Think about GitHub security bugs, or contractors, or disgruntled employees, or lost laptops at a conference. If you check in your password, all of these situations become major liabilities. (Also, note that if you follow these instructions, the `export` command with your password will likely be in your `.bash_history` now, which is kind of bad. However, if you input a space before typing the command, it will not be stored in your history.)

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

## Use with Other Projects

If you work on this project plus another one, your best bet is to *link* this project to your other one. With linking, your other project depends on this one; but instead of a proper install, npm basically symlinks this project into the right place.

    # Go to this project and "link" it into the global namespace (sort of an "export")
    $ cd cloudant
    $ npm link
    /Users/jhs/.nvm/v0.10.25/lib/node_modules/cloudant -> /Users/jhs/src/cloudant/nodejs-cloudant

    # Go to your project and "link" it into there (sort of an "import")
    $ cd ../my-project
    $ npm link cloudant
    /Users/jhs/src/my-project/node_modules/cloudant -> /Users/jhs/.nvm/v0.10.25/lib/node_modules/cloudant -> /Users/jhs/src/cloudant/nodejs-cloudant

Now your project has the dependency in place, however you can work on both of them in tandem.

[nano]: https://github.com/dscape/nano
[query]: http://docs.cloudant.com/api/cloudant-query.html
[search]: http://docs.cloudant.com/api/search.html
[auth]: http://docs.cloudant.com/api/authz.html
[issues]: https://github.com/cloudant/nodejs-cloudant/issues
