// Copyright © 2015, 2021 IBM Corp. All rights reserved.
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
const BasePlugin = require('./plugins/base.js');
const INVALID_DOC_ID_MSG = 'Invalid document ID';
const INVALID_ATT_MSG = 'Invalid attachment name';

Cloudant.BasePlugin = BasePlugin; // expose base plugin

// Parse an object (i.e. { account: "myaccount", password: "mypassword" }) and
// return a URL.
var reconfigure = require('./lib/reconfigure.js');

// Helper function for optional parameter `opts`.
function getCallback(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  return {opts, callback};
}

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

  nano.cc = cloudantClient; // expose Cloudant client
  nano.basePlugin = BasePlugin; // expose base plugin on nano

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

    // Encode '/' path separator if it exists within the document ID
    // or attachment name e.g. _design//foo will result in _design/%2Ffoo
    function encodePathSeparator(docName) {
      if (docName.includes('/')) {
        return docName.replace(/\//g, encodeURIComponent('/'));
      }
      return docName;
    }

    // Validate document ID during document requests.
    // Raises an error if the ID is an `_` prefixed name
    // that isn't either `_design` or `_local`.
    function assertDocumentTypeId(docName) {
      if (docName && docName.startsWith('_')) {
        const possibleDocPrefixes = ['_local/', '_design/'];

        for (let docPrefix of possibleDocPrefixes) {
          if (docName.startsWith(docPrefix) && docName !== docPrefix) {
            // encode '/' if it exists after the document prefix
            return docPrefix + encodePathSeparator(docName.slice(docPrefix.length));
          }
        }
        return new Error(`${INVALID_DOC_ID_MSG}: ${docName}`);
      }
      return docName;
    }

    // Validate attachment name during attachment requests.
    // Raises an error if the name has a `_` prefixed name
    function assertValidAttachmentName(attName) {
      if (attName && attName.startsWith('_')) {
        const error = new Error(`${INVALID_ATT_MSG}: ${attName}`);
        return error;
      } else if (attName && attName.includes('/')) {
        // URI encode slashes in attachment name
        attName = encodePathSeparator(attName);
        return attName;
      }
      return attName;
    }

    function callbackError(result, callback) {
      if (callback) {
        return callback(result, null);
      }
      return Promise.reject(result);
    }

    var getDoc = function getDoc(docName, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      var docResult = assertDocumentTypeId(docName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else {
        return nano._use(db).get(docResult, opts, callback);
      }
    };

    var headDoc = function headDoc(docName, callback0) {
      const {callback} = getCallback(callback0);
      var docResult = assertDocumentTypeId(docName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else {
        return nano._use(db).head(docResult, callback);
      }
    };

    var getAttachment = function getAttachment(docName, attachmentName, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      var docResult = assertDocumentTypeId(docName);
      var attResult = assertValidAttachmentName(attachmentName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else if (attResult instanceof Error) {
        return callbackError(attResult, callback);
      } else {
        return nano._use(db).attachment.get(docResult, attResult, opts, callback);
      }
    };

    var deleteDoc = function deleteDoc(docName, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      var docResult = assertDocumentTypeId(docName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else {
        return nano._use(db).destroy(docResult, opts, callback);
      }
    };

    var deleteAttachment = function deleteAttachment(docName, attachmentName, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      var docResult = assertDocumentTypeId(docName);
      var attResult = assertValidAttachmentName(attachmentName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else if (attResult instanceof Error) {
        return callbackError(attResult, callback);
      } else {
        return nano._use(db).attachment.destroy(docResult, attResult, opts, callback);
      }
    };

    var putAttachment = function putAttachment(docName, attachmentName, att, contentType, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      var docResult = assertDocumentTypeId(docName);
      var attResult = assertValidAttachmentName(attachmentName);
      if (docResult instanceof Error) {
        return callbackError(docResult, callback);
      } else if (attResult instanceof Error) {
        return callbackError(attResult, callback);
      } else {
        return nano._use(db).attachment.insert(docResult, attResult, att, contentType, opts, callback);
      }
    };

    var putDoc = function putDoc(docBody, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      if (typeof opts === 'string') {
        var docResult = assertDocumentTypeId(opts);
        if (docResult instanceof Error) {
          return callbackError(docResult, callback);
        } else {
          return nano._use(db).insert(docBody, docResult, callback);
        }
      }
      return nano._use(db).insert(docBody, opts, callback);
    };

    // Partitioned Databases
    // ---------------------

    function partitionInfo(partitionKey, callback) {
      return nano.request(
        {db: db, path: '_partition/' + partitionKey}, callback
      );
    }

    function executePartitionedView(partitionKey, ddoc, viewName, meta, qs, callback) {
      meta.viewPath = '_partition/' + partitionKey + '/_design/' + ddoc + '/_' +
        meta.type + '/' + viewName;
      // Note: No need to pass `ddoc` or `viewName` to the `baseView` function
      // as they are passed in the `meta.viewPath`.
      return nano._use(db).baseView(null, null, meta, qs, callback);
    }

    function partitionedList(partitionKey, qs0, callback0) {
      const {opts, callback} = getCallback(qs0, callback0);
      let path = '_partition/' + partitionKey + '/_all_docs';
      return nano.request({db: db, path: path, qs: opts}, callback);
    }

    function partitionedListAsStream(partitionKey, qs) {
      let path = '_partition/' + partitionKey + '/_all_docs';
      return nano.request(
        {db: db, path: path, qs: qs, stream: true}, callback
      );
    }

    function partitionedFind(partitionKey, selector, callback) {
      return nano.request({
        db: db,
        path: '_partition/' + partitionKey + '/_find',
        method: 'POST',
        body: selector
      }, callback);
    }

    function partitionedFindAsStream(partitionKey, selector) {
      return nano.request({
        db: db,
        path: '_partition/' + partitionKey + '/_find',
        method: 'POST',
        body: selector,
        stream: true
      });
    }

    function partitionedSearch(partitionKey, ddoc, viewName, qs, callback) {
      return executePartitionedView(
        partitionKey, ddoc, viewName, {type: 'search'}, qs, callback
      );
    }

    function partitionedSearchAsStream(partitionKey, ddoc, viewName, qs) {
      return executePartitionedView(
        partitionKey, ddoc, viewName, {type: 'search', stream: true}, qs
      );
    }

    function partitionedView(partitionKey, ddoc, viewName, qs, callback) {
      return executePartitionedView(
        partitionKey, ddoc, viewName, {type: 'view'}, qs, callback
      );
    }

    function partitionedViewAsStream(partitionKey, ddoc, viewName, qs) {
      return executePartitionedView(
        partitionKey, ddoc, viewName, {type: 'view', stream: true}, qs
      );
    }

    var obj = nano._use(db);

    obj.geo = geo;
    obj.bulk_get = bulk_get; // eslint-disable-line camelcase
    obj.get_security = get_security; // eslint-disable-line camelcase
    obj.set_security = set_security; // eslint-disable-line camelcase
    obj.index = index;
    obj.index.del = index_del; // eslint-disable-line camelcase
    obj.find = find;
    obj.destroy = deleteDoc;
    obj.get = getDoc;
    obj.head = headDoc;
    obj.insert = putDoc;
    obj.attachment.destroy = deleteAttachment;
    obj.attachment.get = getAttachment;
    obj.attachment.insert = putAttachment;

    obj.partitionInfo = partitionInfo;
    obj.partitionedFind = partitionedFind;
    obj.partitionedFindAsStream = partitionedFindAsStream;
    obj.partitionedList = partitionedList;
    obj.partitionedListAsStream = partitionedListAsStream;
    obj.partitionedSearch = partitionedSearch;
    obj.partitionedSearchAsStream = partitionedSearchAsStream;
    obj.partitionedView = partitionedView;
    obj.partitionedViewAsStream = partitionedViewAsStream;

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
    nano.cc._addPlugins({ cookieauth: { errorOnNoCreds: false } });
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
