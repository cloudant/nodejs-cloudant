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

// this the the 'promises' request handler.
// It is a function that returns a Promise and resolves the promise on success 
// or rejects the Promise on failure

var nullcallback = function() {};

module.exports = function(options) {

  var requestDefaults = options.requestDefaults || {jar: false};
  var request = require('request').defaults(requestDefaults);
  var myrequest = function(req, callback) {
    if (typeof callback !== 'function') {
      callback = nullcallback;
    }
    return new Promise(function(resolve, reject) {
      request(req, function(err, h, b) {
        var statusCode = h && h.statusCode || 500;
        if (b) {
          try { b = JSON.parse(b); } catch (err) {  }
        }
        if (statusCode >= 200 && statusCode < 400) {
          callback(null, h, b);
          return resolve(b);
        }
        if (b) {
          b.statusCode = statusCode;
        }
        reject(err || b);
        callback(err, h, b);
      })
    });
  };

  return myrequest;
};
    
    