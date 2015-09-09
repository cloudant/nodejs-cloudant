// reconfigure deals with the various ways the credentials can be passed in 
// and returns an full URL
// e.g. { account:"myaccount", password: "mypassword"}
// or   { key: "mykey", password: "mykey", account:"myaccount"}
// or   { key: "mykey", password: "mykey", account:"myaccount"}
// or   { account:"myaccount.cloudant.com", password: "mykey"}
// or   { account: "myaccount"}
// or   { url: "https://mykey:mypassword@myaccount.cloudant.com"}

module.exports = function(config) {
  config = JSON.parse(JSON.stringify(config)); //clone

  // An account can be just the username, or the full cloudant URL.
  var match = config.account &&
              config.account.match &&
              config.account.match(/(\w+)\.cloudant\.com/);
  if (match)
    config.account = match[1];

  // The username is the account ("foo" for "foo.cloudant.com")
  // or the third-party API key.
  var username = config.key || config.username || config.account;

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