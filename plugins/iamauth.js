// Copyright © 2017, 2019 IBM Corp. All rights reserved.
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
    if (typeof cfg.iamApiKey === 'undefined') {
      throw new Error('Missing IAM API key from configuration');
    }

    // token service retry configuration
    cfg = Object.assign({
      retryDelayMultiplier: 2,
      retryInitialDelayMsecs: 500
    }, cfg);

    super(client, cfg);

    this.currentIamApiKey = null;
    this.baseUrl = cfg.baseUrl || null;
    this.cookieJar = null;
    this.tokenUrl = cfg.iamTokenUrl || 'https://iam.cloud.ibm.com/identity/token';
    this.refreshRequired = true;
  }

  onRequest(state, req, callback) {
    var self = this;

    if (self._cfg.iamApiKey !== self.currentIamApiKey) {
      debug('New IAM API key identified.');
      self.currentIamApiKey = self._cfg.iamApiKey;
      state.stash.newApiKey = true;
    } else if (!self.refreshRequired) {
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

    self.refreshCookie(self._cfg, state, function(error) {
      if (error) {
        debug(error.message);
        if (state.attempt < state.maxAttempt) {
          state.retry = true;
          if (state.attempt === 1) {
            state.retryDelayMsecs = self._cfg.retryInitialDelayMsecs;
          } else {
            state.retryDelayMsecs *= self._cfg.retryDelayMultiplier;
          }
        } else {
          state.abortWithResponse = [ error ]; // return error to client
        }
      } else {
        req.jar = self.cookieJar; // add jar
      }
      callback(state);
    });
  }

  onResponse(state, response, callback) {
    if (response.statusCode === 401) {
      debug('Requesting IAM session refresh for 401 response.');
      this.refreshRequired = true;
      state.retry = true;
    }
    callback(state);
  }

  // Perform IAM session request.
  refreshCookie(cfg, state, callback) {
    var self = this;

    if (self.baseUrl === null) {
      return callback(new Error('Unspecified base URL'));
    }

    self.withLock(cfg.iamLockWaitMsecs || 2000, function(error, done) {
      if (state.stash.newApiKey) {
        debug('Refreshing session with new IAM API key.');
        state.stash.newApiKey = false;
        self.cookieJar = request.jar(); // new jar
      } else if (!self.refreshRequired) {
        debug('Session refresh no longer required.');
        return callback();
      }
      debug('Making IAM session request.');
      var accessToken = null;
      async.series([
        function(callback) {
          var accessTokenAuth;
          if (typeof cfg.iamClientId !== 'undefined' && typeof cfg.iamClientSecret !== 'undefined') {
            accessTokenAuth = { user: cfg.iamClientId, pass: cfg.iamClientSecret };
          }
          // get access token
          self._client({
            url: self.tokenUrl,
            method: 'POST',
            auth: accessTokenAuth,
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
              callback(new Error(`Failed to acquire access token. Status code: ${response.statusCode}`));
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
              self.refreshRequired = false;
              debug('Successfully renewed IAM session.');
              callback();
            } else {
              callback(new Error(`Failed to exchange IAM token with Cloudant. Status code: ${response.statusCode}`));
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

  setIamApiKey(iamApiKey) {
    debug('Setting new IAM API key.');
    this._cfg.iamApiKey = iamApiKey;
  }
}

IAMPlugin.id = 'iamauth';

module.exports = IAMPlugin;
