# Cloudant Node.js Client

This is an alpha version of the Cloudant Node.js client.

## Getting Started

The best way to use the Cloudant client is to begin with your own Node.js project, and define this work as your dependency. In other words, put me in your package.json dependencies. The `npm` tool can do this for you, from the command line:

    $ npm install --save "git+ssh://git@github.com:cloudant/nodejs-cloudant.git#master"

Notice that your package.json will now reflect this GitHub link. Everyting is working if you can run this command with no errors:

    $ node -e 'require("cloudant"); console.log("Cloudant works");'
    Cloudant works

## Resources

First of all, the Cloudant client is based on the excellent open source CouchDB client, [Nano][nano]. Nano has extensive documentation, so it is a great place to learn most of what you need.

The rest of this document focuses on Cloudant-specific features, and describes the differences from Nano.

To begin, in any file which you will use this code, you must of course require it.

```js
var Cloudant = require("cloudant")
```

## Initialization

Initialize your Cloudant connection by supplying your *account* and *password*, and supplying a callback function to run when eveything is ready.

```js
Cloudant({account:"jhs", password:"s3cret"}, ready)

function ready(cloudant, info) {
  console.log('Connected to cloudant; server info %j', info)
}
```

## Development

To join the effort developing this project, start from our GitHub page: https://github.com/cloudant/nodejs-cloudant

First clone this project from GitHub, and then install its dependencies using npm.

    $ git clone https://github.com/cloudant/nodejs-cloudant
    $ npm install



## Test Suite

## Project Status

## Usage

[nano]: https://github.com/dscape/nano
