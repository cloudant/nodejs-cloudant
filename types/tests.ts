// Copyright © 2018 IBM Corp. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import cloudant = require("@cloudant/cloudant");
import nano = require("nano");

/*
 * Instantiate with configuration object
 */
const config: cloudant.Configuration = {
  account: "my-cloudant-account",
  password: "my-password",
  plugins: 'retry',
  maxAttempt: 3
};

const cfgInstance = cloudant(config);

/*
 * Run Initialization Callback
 */
cloudant(config, (error, client, pong) => {
  if (error) {
    return;
  } else if (client) {
    client.db.list((error, allDbs) => {});
  }
});

/*
 * Server Scope
 */
const instance =  <cloudant.ServerScope> cloudant(
  "http://localhost:5984/emails"
);

instance.ping((pong) => {});

instance.generate_api_key((error, key) => {});

const cors: cloudant.CORS = {
  enable_cors: true,
  allow_credentials: true,
  origins: ["*"]
};

instance.set_cors(cors, (error, data) => {});
instance.get_cors((error, data) => {});

const virtualHost: cloudant.VirtualHost = {
  host: 'www.example.com',
  path: 'the-path'
};

instance.add_virtual_host(virtualHost, (error, resp) => {});
instance.get_virtual_hosts((error, hosts) => {});
instance.delete_virtual_host(virtualHost, (error, resp) => {});

/*
 * Document Scope
 */

const mydb: cloudant.DocumentScope<{}> = instance.use("mydb");

const docs: nano.BulkModifyDocsWrapper = {
  docs: [ { id: 'doc1' }, { id: 'doc2' } ]
};

mydb.bulk_get(docs, (results) => {});

const security: cloudant.Security = {
  nobody: [],
  nodejs : [ '_reader', '_writer', '_admin', '_replicator' ]
};

mydb.set_security(security, (error, resp) => {});
mydb.get_security((err, resp) => {});

const params: cloudant.SearchParams = {
  limit: 10,
  q: 'bird:*'
};

mydb.search("design", "doc", params, (err, resp) => {});

const geoParams: cloudant.GeoParams = {
  include_docs: true,
  lat: 27.000,
  lon: 28.00
};

mydb.geo('design', "docname", geoParams, (err, result) => {});

const myIndex = {
  index: { fields: [ 'foo' ] },
  name: 'foo-index',
  type: 'json'
};

mydb.index(myIndex, (err, resp) => {}); // create index

mydb.index((err: any, resp: any) => {}); // see all indexes

const myDeleteSpec: cloudant.QueryDeleteSpec = {
    ddoc: '_design/1f003ce73056238720c2e8f7da545390a8ea1dc5',
    name: 'foo-index'
};

mydb.index.del(myDeleteSpec, (err, resp) => {}); // delete index
