module.exports = { reconfigure: reconfigure
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
    config = 'https://' + config.account + ':' + config.password + '@' + config.account + '.cloudant.com';
  else if (config.account)
    config = 'https://' + config.account + '.cloudant.com';

  return config;
}
