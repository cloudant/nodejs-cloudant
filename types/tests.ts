// Copyright © 2018, 2019 IBM Corp. All rights reserved.
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

/* tslint:disable:no-empty */
import cloudant = require('@cloudant/cloudant');
import nano = require('nano');

const { BasePlugin } = cloudant;

interface ICustomPluginConfig extends cloudant.PluginConfig {
  customLoggingEnabled?: boolean;
}

class CustomPlugin extends BasePlugin {
  public static id = 'custom';

  constructor(client: nano.DocumentScope<{}>, configuration: ICustomPluginConfig) {
    const cfg = Object.assign({
      customLoggingEnabled: true
    }, configuration);

    super(client, cfg);
  }

  // tslint:disable-next-line:max-line-length
  public onRequest(state: cloudant.PluginState, request: cloudant.PluginRequest, callback: cloudant.PluginCallbackFunction) {
    const { customLoggingEnabled } = this._cfg as ICustomPluginConfig;

    if (customLoggingEnabled) {
      // tslint:disable-next-line:no-console
      console.log('%s request made to %s with headers %o', request.method, request.uri, request.headers);
    }

    callback(state);
  }

  // tslint:disable-next-line:max-line-length
  public onResponse(state: cloudant.PluginState, response: cloudant.PluginResponse, callback: cloudant.PluginCallbackFunction) {
    const { customLoggingEnabled } = this._cfg as ICustomPluginConfig;

    if (customLoggingEnabled) {
      // tslint:disable-next-line
      console.log('%d response for %s request made to %s', response.statusCode, response.request.method, response.request.uri);
    }

    callback(state);
  }

  // tslint:disable-next-line:max-line-length
  public onError(state: cloudant.PluginState, error: Error, callback: cloudant.PluginCallbackFunction) {
    const { customLoggingEnabled } = this._cfg as ICustomPluginConfig;

    if (customLoggingEnabled) {
      // tslint:disable-next-line:no-console
      console.error(error);
    }

    callback(state);
  }
}

/*
 * Instantiate with configuration object
 */
const config: cloudant.Configuration = {
  account: 'my-cloudant-account',
  maxAttempt: 3,
  password: 'my-password',
  plugins: [CustomPlugin, 'retry']
};

const cfgInstance = cloudant(config);

/*
 * Instantiate with VCAP configuration object
 */

const vcapConfig: cloudant.Configuration = {
    vcapInstanceName: 'foo',
    vcapServiceName: 'cloudantXYZ',
    vcapServices: JSON.parse(process.env.VCAP_SERVICES || '{}')
};

const vcapInstance = cloudant(vcapConfig);

/*
 * Run Initialization Callback
 */
cloudant(config, (error, client, pong) => {
  if (error) {
    return;
  } else if (client) {
    client.db.list((err, allDbs) => {});
  }
});

/*
 * Server Scope
 */
const instance = cloudant('http://localhost:5984');

instance.ping((pong) => {});
instance.ping().then((pong) => {});

instance.generate_api_key((error, key) => {});
instance.generate_api_key().then((key) => {});

const cors: cloudant.CORS = {
  allow_credentials: true,
  enable_cors: true,
  origins: ['*']
};

instance.set_cors(cors, (error, data) => {});
instance.set_cors(cors).then((data) => {});

instance.get_cors((error, data) => {});
instance.get_cors().then((data) => {});

/*
 * Document Scope
 */

const mydb: cloudant.DocumentScope<{}> = instance.use('mydb');

const docs: nano.BulkModifyDocsWrapper = {
  docs: [ { id: 'doc1' }, { id: 'doc2' } ]
};

mydb.bulk_get(docs, (results) => {});
mydb.bulk_get(docs).then((results) => {});

const security: cloudant.Security = {
  nobody: [],
  nodejs : [ '_reader', '_writer', '_admin', '_replicator' ]
};

mydb.set_security(security, (error, resp) => {});
mydb.set_security(security).then((resp) => {});

mydb.get_security((err, resp) => {});
mydb.get_security().then((resp) => {});

const params: nano.DocumentSearchParams = {
  limit: 10,
  q: 'bird:*'
};

mydb.search('design', 'doc', params, (err, resp) => {});
mydb.search('design', 'doc', params).then((resp) => {});

const geoParams: cloudant.GeoParams = {
  include_docs: true,
  lat: 27.000,
  lon: 28.00
};

mydb.geo('design', 'docname', geoParams, (err, result) => {});
mydb.geo('design', 'docname', geoParams).then((result) => {});

const myIndex = {
  index: { fields: [ 'foo' ] },
  name: 'foo-index',
  type: 'json'
};

// Create an index.
mydb.index(myIndex, (err, resp) => {});
mydb.index(myIndex).then((resp) => {});

// See all indexes.
mydb.index((err: any, resp: any) => {});
mydb.index().then((resp) => {});

const myDeleteSpec: cloudant.QueryDeleteSpec = {
    ddoc: '_design/1f003ce73056238720c2e8f7da545390a8ea1dc5',
    name: 'foo-index'
};

// Delete an index.
mydb.index.del(myDeleteSpec, (err, resp) => {});
mydb.index.del(myDeleteSpec).then((resp) => {});
