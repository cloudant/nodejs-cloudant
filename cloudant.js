module.exports = Cloudant;

/**
 * Copyright (c) 2015 IBM Cloudant, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

var Nano = require('nano'),
  debug = require('debug')('cloudant'),
  nanodebug = require('debug')('nano'),
  url = require('url');

// function from the old Cloudant library to 
// parse an object { account: "myaccount", password: "mypassword"}
var reconfigure = function(config) {
  config = JSON.parse(JSON.stringify(config)); //clone

  // An account can be just the username, or the full cloudant URL.
  var match = config.account && 
              config.account.match && 
              config.account.match(/(\w+)\.cloudant\.com/);
  if (match)
    config.account = match[1];

  // The username is the account ("foo" for "foo.cloudant.com") 
  // or the third-party API key.
  var username = config.key || config.account;

  // Configure for Cloudant, either authenticated or anonymous.
  if (config.account && config.password)
    config.url = 'https://' + encodeURIComponent(username) + ':' + 
                  encodeURIComponent(config.password) + '@' + 
                  encodeURIComponent(config.account) + '.cloudant.com';
  else if (config.account)
    config.url = 'https://' + encodeURIComponent(config.account) + 
                 '.cloudant.com';

  return config.url;
};

// This IS the Cloudant API. It is mostly nano, with a few functions.
function Cloudant(credentials, callback) {
  debug('Initialize', credentials);

  // keep a copy of the credentials
  var pkg = require('./package.json');
  var useragent = "nodejs-cloudant/" + pkg.version + " (Node.js " + process.version + ")";
  var requestDefaults = { headers: { "User-agent": useragent}/*, gzip:true*/  };
  if (typeof credentials == "object") {
    if (credentials.requestDefaults) {
      requestDefaults = credentials.requestDefaults;
    }
    credentials = reconfigure(credentials);
  } else {
    var parsed = url.parse(credentials);
    if (parsed.protocol === "http:" && typeof parsed.auth == "string") {
      console.warn("WARNING: You are passing your authentication credentials in plaintext over the HTTP protocol. It is highly recommend you use HTTPS instead and future versions of this library will enforce this.");
    }
  }

  debug('Create underlying Nano instance, credentials=%j requestDefaults=%j', credentials, requestDefaults);
  var nano = Nano({url:credentials, requestDefaults: requestDefaults, log: nanodebug});

  // our own implementation of 'use' e.g. nano.use or nano.db.use
  // it includes all db-level functions
  var use = function(db) {
    
    // ****************
    // Functions added to each db e.g. cloudant.use("mydb")
    // ****************
    
    // https://docs.cloudant.com/api.html#viewing-permissions
    var get_security = function(callback) {
      var path = "_api/v2/db/" + encodeURIComponent(db) + "/_security";
      nano.request( { path: path}, callback);
    };

    // https://docs.cloudant.com/api.html#modifying-permissions
    var set_security = function(permissions, callback) {
      var path = "_api/v2/db/" + encodeURIComponent(db) + "/_security";
      nano.request( { path: path, 
                      method: "put", 
                      body: {cloudant: permissions} }, callback);
    };
    
    // https://docs.cloudant.com/api.html#list-all-indexes &
    // https://docs.cloudant.com/api.html#creating-a-new-index
    var index = function(definition, callback) {
      
      // if no definition is provided, then the user wants see all the indexes
      if (typeof definition == "function") {  
        callback = definition;
        nano.request({ path: encodeURIComponent(db) + "/_index" }, callback);
      } else {
        // the user wants to create a new index
        nano.request({ path: encodeURIComponent(db) + "/_index", 
                       method:"post", 
                       body: definition}, callback);
      }
    };
    
    // https://docs.cloudant.com/api.html#deleting-an-index
    var index_del = function(spec, callback) {
      spec = spec || {};
      if (!spec.ddoc)
        throw new Error('index.del() must specify a "ddoc" value');
      if (!spec.name)
        throw new Error('index.del() must specify a "name" value');
      var type = spec.type || 'json';     
      var path = encodeURIComponent(db) + "/_index/" + 
                 encodeURIComponent(spec.ddoc) + "/" + 
                 encodeURIComponent(type) + "/" + 
                 encodeURIComponent(spec.name);
      nano.request({ path:path, method:"delete"}, callback);
    };
    
    // https://docs.cloudant.com/api.html#finding-documents-using-an-index
    var find = function(query, callback) {
      nano.request( { path: encodeURIComponent(db) + "/_find", 
                      method: "post", 
                      body: query}, callback);
    };

    // add Cloudant special functions
    var obj = nano._use(db);
    obj.get_security = get_security;
    obj.set_security = set_security;
    obj.index = index;
    obj.index.del = index_del;
    obj.find = find;
    
    return obj;
  };

  // intercept calls to 'nano.use' to plugin our extensions
  nano._use = nano.use;
  nano.use = nano.db.use = use;


  // https://docs.cloudant.com/api.html#creating-api-keys
  var generate_api_key = function(callback) {
    nano.request({path: "_api/v2/api_keys", method: "post" }, callback);
  };

  // https://docs.cloudant.com/api.html#reading-the-cors-configuration
  var get_cors = function(callback) {
    nano.request({path: "_api/v2/user/config/cors" }, callback);
  };

  // https://docs.cloudant.com/api.html#setting-the-cors-configuration
  var set_cors = function(configuration, callback) {
    nano.request({path: "_api/v2/user/config/cors", 
                  method: "put", 
                  body: configuration }, callback);
  };

  // the /set_permissions API call is deprecated
  var set_permissions = function(opts, callback) {
    console.error("set_permissions is deprecated. use set_security instead");
    callback(null, null);
  };

  // add top-level Cloudant-specific functions
  nano.ping = ping;
  nano.get_cors = get_cors;
  nano.set_cors = set_cors;
  nano.set_permissions = set_permissions;
  nano.generate_api_key = generate_api_key;

  if (callback) {
    debug('Automatic ping');
    nano.ping(function(er, pong, headers) {
      if (er) {
        callback(er);
      } else {
        callback(null, nano, pong, headers);
      }
    });
  }

  return nano;
}

function ping(callback) {
  var nano = this;

  // Only call back once.
  var inner_callback = callback;
  callback = function(er, result) {
    inner_callback(er, result);
    inner_callback = function() {};
  };

  var done = {welcome:false, session:false};
  nano.session(       function(er, body) { returned('session', er, body); });
  nano.relax({db:""}, function(er, body) { returned('welcome', er, body); });

  function returned(type, er, body) {
    if (er)
      return callback(er);

    debug('Pong/%s %j', type, body);
    done[type] = body;
    if (done.welcome && done.session) {
      // Return the CouchDB "Welcome" body but with the userCtx added in.
      done.welcome.userCtx = done.session.userCtx;
      callback(null, done.welcome);
    }
  }
}
