// this the the 'promises' request handler.
// It is a function that returns a Promise and resolves the promise on success 
// or rejects the Promise on failure
var request = require('request');

var nullcallback = function() {};

module.exports = function(req, callback) {
  if (typeof callback !== 'function') {
    callback = nullcallback;
  }
  return new Promise(function(resolve, reject) {
    request(req, function(err, h, b) {
      var statusCode = h && h.statusCode || 500;
      if (statusCode >= 200 && statusCode < 400) {
        callback(null, b);
        return resolve(b);
      }
      reject(b);
      callback(err, b);
    })
  });
};
    
    