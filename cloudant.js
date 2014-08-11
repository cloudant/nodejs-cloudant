module.exports = { reconfigure: reconfigure
                 , fix_request     : fix_request
                 , db_functions    : db_functions
                 , server_functions: server_functions
                 };

//
// Cloudant functionality
//

var _ = require('underscore');


// Rebuild a standard Nano configuration object into one for use with Cloudant.
function reconfigure(config) {
  config = _.clone(config || {});

  // An account can be just the username, or the full cloudant URL.
  var match = config.account && config.account.match && config.account.match(/(\w+)\.cloudant\.com/);
  if (match)
    config.account = match[1];

  // Configure for Cloudant, either authenticated or anonymous.
  if (config.account && config.password)
    config.url = 'https://' + config.account + ':' + config.password + '@' + config.account + '.cloudant.com';
  else if (config.account)
    config.url = 'https://' + config.account + '.cloudant.com';

  return config;
}


// Add the Cloudant API for database functions.
function db_functions(db, relax) {
  return db;
}


// Add the Cloudant API for server functions.
function server_functions(nano) {
  return nano;
}


function fix_request(req, config) {
}
