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

// this the the 'cookieauth' request handler.
// Instead of passing the authentication credentials using HTTP Basic Auth with every request
// we exchange the credentials for a cookie which we remember and pass back with each
// subsequent request.
var async = require('async');
var debug = require('debug')('cloudant');
var stream = require('stream');
var u = require('url');
var nullcallback = function() {};

module.exports = function(options) {
  var requestDefaults = options.requestDefaults || {};
  var request = require('request').defaults(requestDefaults);
  var jar = request.jar();
  var cookieRefresh = null;

  // make a request using cookie authentication
  // 1) if we have a cookie or have no credentials, just try the request
  // 2) otherwise, get session cookie
  // 3) then try the request
  var cookieRequest = function(req, callback) {
    // deal with absence of callback
    if (typeof callback !== 'function') {
      callback = nullcallback;
    }

    // parse the url to extract credentials and calculate
    // stuburl - the cloudant url without credentials or auth
    // auth - whether there are credentials or not
    // credentials - object containing username & password
    var url = req.uri || req.url;
    var parsed = u.parse(url);
    var auth = parsed.auth;
    var credentials = null;
    delete parsed.auth;
    delete parsed.href;
    url = u.format(parsed);
    if (auth) {
      var bits = auth.split(':');
      credentials = {
        username: bits[0],
        password: bits[1]
      };
    }
    req.url = url;
    delete req.uri;
    delete parsed.path;
    delete parsed.pathname;
    var stuburl = u.format(parsed).replace(/\/$/, '');

    // to maintain streaming compatiblity, always return a PassThrough stream
    var s = new stream.PassThrough();

    // run these three things in series
    async.series([

      // call the request being asked for
      function(done) {
        // do we have cookie for this domain name?
        var cookies = jar.getCookies(stuburl);
        var statusCode = 500;

        // if we have a cookie for this domain, then we can try the required API call straight away
        if (!auth || cookies.length > 0) {
          debug('we have cookies (or no credentials) so attempting API call straight away');
          req.jar = jar;
          request(req, function(e, h, b) {
            // if we have no credentials or we suceeded
            if (!auth || (statusCode >= 200 && statusCode < 400)) {
              // returning an err of true stops the async sequence
              // we're good because we didn't get a 4** or 5**
              done(true, [e, h, b]);
            } else {
              // continue with the async chain
              done(null, [e, h, b]);
            }
          }).on('response', function(r) {
            statusCode = (r && r.statusCode) || 500;
          }).on('data', function(chunk) {
            // only write to the output stream on success
            if (statusCode < 400) {
              s.write(chunk);
            }
          });
        } else {
          debug('we have no cookies - need to authenticate first');
          // we have no cookies so we need to authenticate first
          // i.e. do nothing here
          done(null, null);
        }
      },

      // call POST /_session to get a cookie
      function(done) {
        debug('need to authenticate - calling POST /_session');
        var r = {
          url: stuburl + '/_session',
          method: 'post',
          form: {
            name: credentials.username,
            password: credentials.password
          },
          jar: jar
        };
        request(r, function(e, h, b) {
          var statusCode = (h && h.statusCode) || 500;
          // if we sucessfully authenticate
          if (statusCode >= 200 && statusCode < 400) {
            // continue to the next stage of the async chain
            debug('authentication successful');

            // if we don't already have a timer set to refresh the cookie every hour,
            // set one up
            if (!cookieRefresh) {
              debug('setting up recurring cookie refresh request');
              cookieRefresh = setInterval(function() {
                debug('refreshing cookie');
                request({method: 'get', url: stuburl + '/_session', jar: jar});
              }, 1000 * 60 * 60);
              // prevent setInterval from requiring the event loop to be active
              cookieRefresh.unref();
            }

            done(null, [e, h, b]);
          } else {
            // failed to authenticate - no point proceeding any further
            debug('authentication failed');
            done(true, [e, h, b]);
          }
        });
      },

      // call the request being asked for with cookie authentication
      function(done) {
        debug('attempting API call with cookie');
        var statusCode = 500;
        req.jar = jar;
        request(req, function(e, h, b) {
          done(null, [e, h, b]);
        }).on('response', function(r) {
          statusCode = (r && r.statusCode) || 500;
        }).on('data', function(chunk) {
          if (statusCode < 400) {
            s.write(chunk);
          }
        });
      }
    ], function(err, data) {
        // callback with the last call we made
      if (data && data.length > 0) {
        var reply = data[data.length - 1];
          // error, headers, body
        callback(reply[0], reply[1], reply[2]);
      } else {
        callback(err, { statusCode: 500 }, null);
      }
    });

    // return the pass-through stream
    return s;
  };

  return cookieRequest;
};
