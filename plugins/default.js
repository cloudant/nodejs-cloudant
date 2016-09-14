// this the the 'default' request handler.
// It is simply an instance of the popular 'request' npm module.
// This is the simplest module to use as it supports JavaScript callbacks
// and can be used for with the Node.js streaming API.

module.exports = function(options) {
  return require('request');
}