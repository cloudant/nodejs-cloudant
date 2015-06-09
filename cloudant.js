var nano = null;

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

// this IS the Cloudant library. It's nano + a few functions
module.exports = function(credentials, couchdbcallback) {
  
  // keep a copy of the credentials
  var requestDefaults = {};
  if (typeof credentials == "object") {
    if (credentials.requestDefaults) {
      requestDefaults = credentials.requestDefaults;
    }
    credentials = reconfigure(credentials);
  }
  
  // create a nano instance
  nano = require('nano')({ url: credentials, 
                           requestDefaults: requestDefaults}, 
                          couchdbcallback || null);  
  
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
  delete nano.use;
  delete nano.db.use;
  nano.use = nano.db.use = use;

  // add top-level Cloudant-specific functions
  nano.generate_api_key = generate_api_key;
  nano.get_cors = get_cors;
  nano.set_cors = set_cors;
  nano.set_permissions = set_permissions;
  
  return nano;
};