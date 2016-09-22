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

// this the the 'retry' request handler.
// If CouchDB/Cloudant responds with a 429 HTTP code
// the library will retry the request up to three
// times with exponential backoff.
// This module is unsuitable for streaming requests.
var async = require('async');
var debug = require('debug')('cloudant');

module.exports = function(options) {
  var requestDefaults = options.requestDefaults || {jar: false};
  var request = require('request').defaults(requestDefaults);

  var myrequest = function(req, callback) {
    var attempts = 0;
    var maxAttempts = options.retryAttempts || 3;
    var firstTimeout = options.retryTimeout || 500; // ms
    var timeout = 0; // ms
    var statusCode = null;

    // do the first function until the second function returns true
    async.doUntil(function(done) {
      attempts++;
      if (attempts > 1) {
        debug('attempt', attempts, 'timeout', timeout);
      }
      setTimeout(function() {
        request(req, function(e, h, b) {
          statusCode = h && h.statusCode || 500;
          done(null, [e, h, b]);
        });  
      }, timeout);
    }, function() {
      // this function returns false for the first 'maxAttempts' 429s receieved
      if (statusCode === 429 && attempts < maxAttempts) {
        if (attempts === 1) {
          timeout = firstTimeout;
        } else {
          timeout *= 2;
        }
        return false;
      } 
      return true;
    }, function(e, results) {
      callback(results[0], results[1], results[2])
    });
  };

  return myrequest;
};
    
    
    