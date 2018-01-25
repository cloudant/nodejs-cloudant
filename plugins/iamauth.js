// Copyright © 2017 IBM Corp. All rights reserved.
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

const async = require('async');
const debug = require('debug')('cloudant:plugins:iamauth');
const request = require('request');
const u = require('url');

const BasePlugin = require('./base.js');

/**
 * IAM Authentication plugin.
 */
class IAMPlugin extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);

    var self = this;
    self.iamApiKey = null;
    self.baseUrl = cfg.baseUrl || null;
    self.cookieJar = request.jar();
    self.tokenUrl = cfg.iamTokenUrl || 'https://iam.bluemix.net/identity/token';

    // Specifies whether IAM authentication should be applied to the request being intercepted.
    self.shouldApplyIAMAuth = true;
    self.refreshRequired = true;

    if (typeof cfg.iamApiKey === 'undefined') {
      debug('Missing IAM API key. Skipping IAM authentication.');
      self.shouldApplyIAMAuth = false;
    }
  }

  onRequest(state, req, callback) {
    var self = this;

    if (typeof self._cfg.iamApiKey === 'undefined') {
      throw new Error('Missing IAM API key from configuration');
    }

    if (self._cfg.iamApiKey !== self.iamApiKey) {
      debug('New credentials identified. Renewing session cookie...');
      self.shouldApplyIAMAuth = self.refreshRequired = true;
    }

    if (!self.shouldApplyIAMAuth) {
      return callback(state);
    }

    if (!self.refreshRequired) {
      if (self.baseUrl && self.cookieJar.getCookies(self.baseUrl, {expire: true}).length === 0) {
        debug('There are no valid session cookies in the jar. Requesting IAM session refresh...');
      } else {
        req.jar = self.cookieJar; // add jar
        return callback(state);
      }
    }

    req.url = req.uri || req.url;
    delete req.uri;

    if (self.baseUrl === null) {
      var parsed = u.parse(req.url);
      self.baseUrl = u.format({
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port
      });
    }

    self.refreshCookie(self._cfg, function(error) {
      if (error) {
        debug(error.message);
        if (self.shouldApplyIAMAuth) {
          state.retry = true;
        }
      } else {
        req.jar = self.cookieJar; // add jar
      }
      callback(state);
    });
  }

  onResponse(state, response, callback) {
    if (this.shouldApplyIAMAuth && response.statusCode === 401) {
      debug('Requesting IAM session refresh for 401 response.');
      this.refreshRequired = true;
      state.retry = true;
    }
    callback(state);
  }

  // Perform IAM session request.
  refreshCookie(cfg, callback) {
    var self = this;

    if (self.baseUrl === null) {
      return callback(new Error('Unspecified base URL'));
    }

    self.withLock({
      stale: cfg.iamLockStaleMsecs || 2500, // 2.5 secs
      wait: cfg.iamLockWaitMsecs || 2000 // 2 secs
    }, function(error, done) {
      if (!self.shouldApplyIAMAuth) {
        return callback(new Error('Skipping IAM session authentication'));
      }
      if (!self.refreshRequired) {
        debug('Session refresh no longer required.');
        return callback();
      }
      debug('Making IAM session request.');
      var accessToken = null;
      async.series([
        function(callback) {
          // get access token
          self._client({
            url: self.tokenUrl,
            method: 'POST',
            auth: { user: 'bx', pass: 'bx' },
            headers: { 'Accepts': 'application/json' },
            form: {
              'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
              'response_type': 'cloud_iam',
              'apikey': cfg.iamApiKey
            },
            json: true
          }, function(error, response, body) {
            if (error) {
              callback(error);
            } else if (response.statusCode === 200) {
              if (body.access_token) {
                accessToken = body.access_token;
                debug('Retrieved access token from IAM token service.');
                callback();
              } else {
                callback(new Error('Invalid response from IAM token service'));
              }
            } else {
              self.shouldApplyIAMAuth = false;
              callback(new Error('Failed to access token'));
            }
          });
        },
        function(callback) {
          // perform IAM cookie based user login
          self._client({
            url: self.baseUrl + '/_iam_session',
            method: 'POST',
            form: { 'access_token': accessToken },
            jar: self.cookieJar,
            json: true
          }, function(error, response, body) {
            if (error) {
              callback(error);
            } else if (response.statusCode === 200) {
              self.iamApiKey = cfg.iamApiKey;
              self.refreshRequired = false;
              debug('Successfully renewed IAM session.');
              callback();
            } else {
              self.shouldApplyIAMAuth = false;
              callback(new Error('Failed to exchange IAM token with Cloudant'));
            }
          });
        }
      ],
      function(error) {
        done();  // release lock
        callback(error);
      });
    });
  }
}

IAMPlugin.id = 'iamauth';

module.exports = IAMPlugin;
