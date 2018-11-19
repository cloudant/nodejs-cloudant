// Copyright © 2015, 2018 IBM Corp. All rights reserved.
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
'use strict';

module.exports = Cloudant;

var Nano = require('nano');
var debug = require('debug')('cloudant:cloudant');
var nanodebug = require('debug')('nano');

const Client = require('./lib/client.js');

// Parse an object (i.e. { account: "myaccount", password: "mypassword" }) and
// return a URL.
var reconfigure = require('./lib/reconfigure.js');

// This IS the Cloudant API. It is mostly nano, with a few functions.
function Cloudant(options, callback) {
  debug('Initialize', options);

  if (typeof options !== 'object') {
    options = { url: options };
  }

  var creds = reconfigure(options);
  if (!creds || creds.outUrl === null) {
    var err = new Error('Invalid URL');
    if (callback) {
      return callback(err);
    } else {
      throw err;
    }
  } else {
    options.creds = creds;
  }

  if (creds.outUrl.match(/^http:/)) {
    options.https = false;
  }

  debug('Creating Cloudant client with options: %j', options);
  var cloudantClient = new Client(options);
  var cloudantRequest = function(req, callback) {
    return cloudantClient.request(req, callback);
  };

  var nanoOptions = {
    log: nanodebug,
    parseUrl: false, // always return server object
    request: cloudantRequest,
    url: creds.outUrl
  };
  if (options.cookie) {
    nanoOptions.cookie = options.cookie; // legacy - sets 'X-CouchDB-WWW-Authenticate' header
  }

  debug('Creating Nano instance with options: %j', nanoOptions);
  var nano = Nano(nanoOptions);

  nano.cc = cloudantClient;  // expose Cloudant client
  nano.basePlugin = require('./plugins/base.js'); // expose base plugin

  // ===========================
  // Cloudant Database Functions
  // ===========================

  var use = function(db) {
    // https://console.bluemix.net/docs/services/Cloudant/api/document.html#the-_bulk_get-endpoint
    var bulk_get = function(options, callback) { // eslint-disable-line camelcase
      return nano.request({ path: encodeURIComponent(db) + '/_bulk_get',
        method: 'post',
        body: options }, callback);
    };

    // https://console.bluemix.net/docs/services/Cloudant/api/cloudant-geo.html#cloudant-geospatial
    var geo = function(docName, indexName, query, callback) {
      var path = encodeURIComponent(db) + '/_design/' +
                 encodeURIComponent(docName) + '/_geo/' +
                 encodeURIComponent(indexName);
      return nano.request({path: path, qs: query}, callback);
    };

    // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#viewing-permissions
    var get_security = function(callback) { // eslint-disable-line camelcase
      var path = '_api/v2/db/' + encodeURIComponent(db) + '/_security'; // eslint-disable-line camelcase
      return nano.request({ path: path }, callback);
    };

   // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#modifying-permissions
    var set_security = function(permissions, callback) { // eslint-disable-line camelcase
      var body = permissions;
      var prefix = '_api/v2/db/'; // use `/_api/v2/<db>/_security` endpoint

      if (permissions['couchdb_auth_only']) {
        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#using-the-_users-database-with-cloudant-nosql-db
        prefix = ''; // use `/<db>/_security` endpoint
      } else if (!permissions.cloudant) {
        body = { cloudant: permissions };
      }

      return nano.request({
        path: prefix + encodeURIComponent(db) + '/_security',
        method: 'put',
        body: body
      }, callback);
    };

    // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#query
    var index = function(definition, callback) {
      // if no definition is provided, then the user wants see all the indexes
      if (typeof definition === 'function' || typeof definition === 'undefined') {
        callback = definition;
        return nano.request({ path: encodeURIComponent(db) + '/_index' }, callback);
      } else {
        // the user wants to create a new index
        return nano.request({ path: encodeURIComponent(db) + '/_index',
          method: 'post',
          body: definition}, callback);
      }
    };

    // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#deleting-an-index
    var index_del = function(spec, callback) { // eslint-disable-line camelcase
      spec = spec || {};
      if (!spec.ddoc) { throw new Error('index.del() must specify a "ddoc" value'); }
      if (!spec.name) { throw new Error('index.del() must specify a "name" value'); }
      var type = spec.type || 'json';
      var path = encodeURIComponent(db) + '/_index/' +
                 encodeURIComponent(spec.ddoc) + '/' +
                 encodeURIComponent(type) + '/' +
                 encodeURIComponent(spec.name);
      return nano.request({ path: path, method: 'delete' }, callback);
    };

    // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#finding-documents-by-using-an-index
    var find = function(query, callback) {
      return nano.request({ path: encodeURIComponent(db) + '/_find',
        method: 'post',
        body: query}, callback);
    };

    var obj = nano._use(db);
    obj.geo = geo;
    obj.bulk_get = bulk_get; // eslint-disable-line camelcase
    obj.get_security = get_security; // eslint-disable-line camelcase
    obj.set_security = set_security; // eslint-disable-line camelcase
    obj.index = index;
    obj.index.del = index_del; // eslint-disable-line camelcase
    obj.find = find;

    return obj;
  };

  // =================================
  // Cloudant Administrative Functions
  // =================================

  nano._use = nano.use;
  nano.use = nano.db.use = use;

  // https://console.bluemix.net/docs/services/Cloudant/api/account.html#ping
  var ping = function(callback) {
    return nano.request({ path: '', method: 'GET' }, callback);
  };

  // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#api-keys
  var generate_api_key = function(callback) { // eslint-disable-line camelcase
    return nano.request({ path: '_api/v2/api_keys', method: 'post' }, callback);
  };

  // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#reading-the-cors-configuration
  var get_cors = function(callback) { // eslint-disable-line camelcase
    return nano.request({ path: '_api/v2/user/config/cors' }, callback);
  };

  // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#setting-the-cors-configuration
  var set_cors = function(configuration, callback) { // eslint-disable-line camelcase
    return nano.request({path: '_api/v2/user/config/cors',
      method: 'put',
      body: configuration }, callback);
  };

  // add top-level Cloudant-specific functions
  nano.ping = ping;
  nano.get_cors = get_cors; // eslint-disable-line camelcase
  nano.set_cors = set_cors; // eslint-disable-line camelcase
  nano.generate_api_key = generate_api_key; // eslint-disable-line camelcase

  if (callback) {
    nano.cc._addPlugins('cookieauth');
    nano.ping(function(error, pong) {
      if (error) {
        callback(error);
      } else {
        callback(error, nano, pong);
      }
    });
  }

  return nano;
}
