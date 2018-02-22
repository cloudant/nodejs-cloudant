// Copyright © 2015, 2017 IBM Corp. All rights reserved.
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

/*
 * Instantiate with configuration object
 */
const config: cloudant.Configuration = {
  account: "my-cloudant-account",
  password: "my-password",
};

const cfgInstance = cloudant(config);

/*
 * Server Scope
 */
const instance =  <cloudant.ServerScope> cloudant(
  "http://localhost:5984/emails"
);

instance.generate_api_key((error, key) => {});

const cors: cloudant.CORS = {
  enable_cors: true,
  allow_credentials: true,
  origins: ["*"]
};

instance.set_cors(cors, (error, data) => {});

const virtualHost: cloudant.VirtualHost = {
  host: 'www.example.com',
  path: 'the-path'
};

instance.add_virtual_host(virtualHost, (error, resp) => {});
instance.get_virtual_hosts((error, hosts) => {});
instance.delete_virtual_host(virtualHost, (error, resp) => {});

/*
 * Database Scope
 */
const db: cloudant.DatabaseScope = instance.db;

const security: cloudant.Security = {
  nobody: [],
  nodejs : [ '_reader', '_writer', '_admin', '_replicator' ]
};

db.set_security(security, (error, resp) => {});
db.get_security((err, resp) => {});

/*
 * Database Scope
 */

interface SomeDocument {
  name: string;
}

const mydb: cloudant.DocumentScope<SomeDocument> = instance.use("mydb");

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
