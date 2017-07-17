// Copyright © 2015, 2017 IBM Corp. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict';

// this the the 'retry' request handler.
// If CouchDB/Cloudant responds with a 429 HTTP code
// the library will retry the request up to three
// times with exponential backoff.
var async = require('async');
var debug = require('debug')('cloudant');
var stream = require('stream');

module.exports = function(options) {
  var requestDefaults = options.requestDefaults || {jar: false};
  var request = require('request').defaults(requestDefaults);

  var myrequest = function(req, callback) {
    var attempts = 0;
    var maxAttempts = options.retryAttempts || 3;
    var firstTimeout = options.retryTimeout || 500; // ms
    var timeout = 0; // ms
    var retry;

    // create a pass-through stream in case the caller wishes
    // to pipe data using Node.js streams
    var s = new stream.PassThrough();

    // add error listener
    s.on('error', function(err) {
      debug(err);
    });

    // do the first function until the second function returns false
    async.doWhilst(function(done) {
      attempts++;
      retry = false;

      if (attempts >= 1) {
        debug('attempt', attempts, 'timeout', timeout);
      }

      setTimeout(function() {
        var thisRequest = request(req, callback);
        thisRequest
          .on('error', function(err) {
            s.emit('error', err);
            s.end();
            done();
          })
          .on('response', function(r) {
            if (r.statusCode === 429 && attempts < maxAttempts) {
              retry = true;
              thisRequest.abort();
            } else {
              s.emit('response', r);
            }
          })
          .on('data', function(chunk) {
            if (!retry) {
              s.write(chunk);
            }
          })
          .on('end', function() {
            if (!retry) {
              s.end();
            }
            done();
          });
      }, timeout);
    }, function() {
      if (retry) {
        if (attempts === 1) {
          timeout = firstTimeout;
        } else {
          timeout *= 2;
        }
      }
      return retry;
    });

    // return the pass-through stream
    return s;
  };

  return myrequest;
};
