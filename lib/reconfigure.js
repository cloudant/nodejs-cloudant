// reconfigure deals with the various ways the credentials can be passed in 
// and returns an full URL
// e.g. { account:"myaccount", password: "mypassword"}
// or   { key: "mykey", password: "mykey", account:"myaccount"}
// or   { key: "mykey", password: "mykey", account:"myaccount"}
// or   { account:"myaccount.cloudant.com", password: "mykey"}
// or   { account: "myaccount"}
// or   { url: "https://mykey:mypassword@myaccount.cloudant.com"}

var url = require('url');

module.exports = function(config) {
  config = JSON.parse(JSON.stringify(config)); //clone

  var outUrl; 
  // if a full URL is passed in
  if (config.url) {
    
    // parse the URL
    var parsed = url.parse(config.url);

    // enforce HTTPS for *cloudant.com domains
    if (parsed.hostname.match(/cloudant\.com$/) && parsed.protocol == "http:") {
      
      console.warn("WARNING: You are sending your password as plaintext over the HTTP; switching to HTTPS");
      
      // force HTTPS
      parsed.protocol = 'https:';
      
      // remove port number and path
      parsed.host = parsed.host.replace(/:[0-9]*$/,'');
      delete parsed.port; 
      delete parsed.pathname;
      delete parsed.path;
      
      // reconstruct the URL
      config.url = url.format(parsed);
    }
    
    outUrl = config.url;
  
  } else {
    // An account can be just the username, or the full cloudant URL.
    var match = config.account &&
                config.account.match &&
                config.account.match(/(\w+)\.cloudant\.com/);
    if (match)
      config.account = match[1];

    var credentials = getCredentials(config);
    var username = credentials.username;
    var password = credentials.password;

    // Configure for Cloudant, either authenticated or anonymous.
    if (config.account && password) {
      config.url = 'https://' + encodeURIComponent(username) + ':' +
                    encodeURIComponent(password) + '@' +
                    encodeURIComponent(config.account) + '.cloudant.com';
    }
    else if (config.account) {
      config.url = 'https://' + encodeURIComponent(config.account) +
                   '.cloudant.com';
    }
    
    outUrl = config.url;
  }
  
  // We trim out the trailing `/` because when the URL tracks down to `nano` we have to 
  // worry that the trailing `/` doubles up depending on how URLs are built, this creates 
  // "Database does not exist." errors. 
  // Issue: cloudant/nodejs-cloudant#129
  if (outUrl.slice(-1) == '/') {
    outUrl = outUrl.slice(0, -1);
  }
  
  return outUrl;
};

module.exports.getCredentials = getCredentials;
function getCredentials(config) {
  // The username is the account ("foo" for "foo.cloudant.com")
  // or the third-party API key.
  var result = {password:config.password, username: config.key || config.username || config.account};
  return result;
};
