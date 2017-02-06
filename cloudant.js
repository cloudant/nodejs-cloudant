module.exports = Cloudant;

/**
 * Copyright (c) 2016 IBM Cloudant, Inc. All rights reserved.
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

var Nano = require('cloudant-nano');
var debug = require('debug')('cloudant');
var nanodebug = require('debug')('nano');
var async = require('async');


// function from the old Cloudant library to
// parse an object { account: "myaccount", password: "mypassword"}
// and return a URL
var reconfigure = require('./lib/reconfigure.js')

// This IS the Cloudant API. It is mostly nano, with a few functions.
function Cloudant(options, callback) {
  debug('Initialize', options);

  // Save the username and password for potential conversion to cookie auth.
  var login = reconfigure.getOptions(options);

  // Convert the credentials into a URL that will work for cloudant. The
  // credentials object will become squashed into a string, which is fine
  // except for the .cookie option.
  var cookie = options.cookie;

  var pkg = require('./package.json');
  var useragent = "nodejs-cloudant/" + pkg.version + " (Node.js " + process.version + ")";
  var requestDefaults = { headers: { "User-agent": useragent}, gzip:true  };
  var theurl = null;
  if (typeof options == "object") {
    if (options.requestDefaults) {
      requestDefaults = options.requestDefaults;
    }
    theurl = reconfigure(options);
  } else {
    theurl = reconfigure({ url: options})
  }
  if (theurl === null) {
    if (callback) {
      return callback('invalid url', null);
    } else {
      throw(new Error('invalid url'));
    }
  }

  // keep connections alive by default
  if (requestDefaults && !requestDefaults.agent) {
    var protocol = (theurl.match(/^https/))? require('https') : require('http');
    var agent = new protocol.Agent({ keepAlive:true });
    requestDefaults.agent = agent;
  } 

  // plugin a request library
  var plugin = null;
  if (options.plugin) {
    options.requestDefaults = requestDefaults;
    if(typeof options.plugin === 'string') {
      var plugintype = options.plugin || 'default';
      debug('Using the "' + plugintype + '" plugin');
      plugin =  require('./plugins/' + plugintype)(options);
    } else if (typeof options.plugin === 'function') { 
      debug('Using a custom plugin');
      plugin = options.plugin;
    }
  }

  debug('Create underlying Nano instance, options=%j requestDefaults=%j', options, requestDefaults);
  var nano = Nano({url:theurl, request: plugin, requestDefaults: requestDefaults, cookie: cookie, log: nanodebug});

  // our own implementation of 'use' e.g. nano.use or nano.db.use
  // it includes all db-level functions
  var use = function(db) {

    // ****************
    // Functions added to each db e.g. cloudant.use("mydb")
    // ****************

    var bulk_get = function(options, callback) {
      return nano.request( { path: encodeURIComponent(db) + "/_bulk_get",
                             method: "post",
                             body: options }, callback)
    };

    // https://docs.cloudant.com/geo.html
    var geo = function(docName, indexName, query, callback) {
      var path = encodeURIComponent(db) + "/_design/" +
                 encodeURIComponent(docName) + "/_geo/" +
                 encodeURIComponent(indexName);
      return nano.request({path:path, qs:query}, callback);
    };

    // https://docs.cloudant.com/api.html#viewing-permissions
    var get_security = function(callback) {
      var path = "_api/v2/db/" + encodeURIComponent(db) + "/_security";
      return nano.request( { path: path}, callback);
    };

    // https://docs.cloudant.com/api.html#modifying-permissions
    var set_security = function(permissions, callback) {
      var path = "_api/v2/db/" + encodeURIComponent(db) + "/_security";
      return nano.request( { path: path,
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
        return nano.request({ path: encodeURIComponent(db) + "/_index",
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
      return nano.request({ path:path, method:"delete"}, callback);
    };

    // https://docs.cloudant.com/api.html#finding-documents-using-an-index
    var find = function(query, callback) {
      return nano.request( { path: encodeURIComponent(db) + "/_find",
                             method: "post",
                             body: query}, callback);
    };

    // add Cloudant special functions
    var obj = nano._use(db);
    obj.geo = geo;
    obj.bulk_get = bulk_get;
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
    return nano.request({path: "_api/v2/api_keys", method: "post" }, callback);
  };

  // https://docs.cloudant.com/api.html#reading-the-cors-configuration
  var get_cors = function(callback) {
    return nano.request({path: "_api/v2/user/config/cors" }, callback);
  };

  // https://docs.cloudant.com/api.html#setting-the-cors-configuration
  var set_cors = function(configuration, callback) {
    return nano.request({path: "_api/v2/user/config/cors",
                         method: "put",
                         body: configuration }, callback);
  };

  // the /set_permissions API call is deprecated
  var set_permissions = function(opts, callback) {
    console.error("set_permissions is deprecated. use set_security instead");
    callback(null, null);
  };

  // https://docs.cloudant.com/api.html#setting-the-cors-configuration
  var set_cors = function(configuration, callback) {
    return nano.request({path: "_api/v2/user/config/cors",
                         method: "put",
                         body: configuration }, callback);
  };

  var get_virtual_hosts = function(callback) {
    return nano.request({path: "_api/v2/user/virtual_hosts",
                         method: "get"}, callback);
  };

  var add_virtual_host = function(opts, callback) {
    return nano.request({path: "_api/v2/user/virtual_hosts",
                         method: "post",
                         body: opts }, callback);
  };

  var delete_virtual_host = function(opts, callback) {
    return nano.request({path: "_api/v2/user/virtual_hosts",
                         method: "delete",
                         body: opts }, callback);
  };

  // add top-level Cloudant-specific functions
  nano.ping = ping;
  nano.get_cors = get_cors;
  nano.set_cors = set_cors;
  nano.set_permissions = set_permissions;
  nano.generate_api_key = generate_api_key;
  nano.get_virtual_hosts = get_virtual_hosts;
  nano.add_virtual_host = add_virtual_host;
  nano.delete_virtual_host = delete_virtual_host;

  if (callback) {
    debug('Automatic ping');
    nano.ping(login, function(er, pong, cookie) {
      if (er) {
        callback(er);
      } else {
        if (cookie) {
          requestDefaults.headers.cookie = cookie;
        }

        callback(null, nano, pong);
      }
    });
  }

  return nano;
}

function ping(login, callback) {
  var nano = this;
  var cookie = null;

  async.series([
    function(done) {
      if (login && login.username && login.password) {
        done.auth = false;
        nano.auth(login.username, login.password, function(e, b, h) {
          cookie = (h && h['set-cookie']) || null;
          if (cookie) {
            cookie = cookie[0];
          }
          done(e, b);
        });
      } else {
        done(null, null);
      }
    },
    function(done) {
      nano.session(function(e, b, h) {
        done(e, b);
      });
    }, 
    function(done) {
      nano.relax({db:''}, function(e, b, h) {
        done(e, b);
      })
    }
  ], function(err, data) {
    var body = (data && data[2]) || {};
    body.userCtx  = (data && data[1] && data[1].userCtx) || {};
    callback(err, body, cookie);
  });
}


