// Copyright © 2019 IBM Corp. All rights reserved.
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

const a = require('async');
const debug = require('debug')('cloudant:tokens:iamtokenmanager');
const TokenManager = require('./TokenManager');

class IAMTokenManager extends TokenManager {
  constructor(client, jar, sessionUrl, iamTokenUrl, iamApiKey, iamClientId, iamClientSecret) {
    super(client, jar, sessionUrl);

    this._iamTokenUrl = iamTokenUrl;
    this._iamApiKey = iamApiKey;
    this._iamClientId = iamClientId;
    this._iamClientSecret = iamClientSecret;
  }

  _getToken(done) {
    var self = this;

    debug('Making IAM session request.');
    let accessToken;
    a.series([
      (callback) => {
        let accessTokenAuth;
        if (self._iamClientId && self._iamClientSecret) {
          accessTokenAuth = { user: self._iamClientId, pass: self._iamClientSecret };
        }
        debug('Getting access token.');
        self._client({
          url: self._iamTokenUrl,
          method: 'POST',
          auth: accessTokenAuth,
          headers: { 'Accepts': 'application/json' },
          form: {
            'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
            'response_type': 'cloud_iam',
            'apikey': self._iamApiKey
          },
          json: true
        }, (error, response, body) => {
          if (error) {
            callback(error);
          } else if (response.statusCode === 200) {
            if (body.access_token) {
              accessToken = body.access_token;
              debug('Retrieved access token from IAM token service.');
              callback(null, response);
            } else {
              callback(new Error('Invalid response from IAM token service'), response);
            }
          } else {
            let msg = `Failed to acquire access token. Status code: ${response.statusCode}`;
            callback(new Error(msg), response);
          }
        });
      },
      (callback) => {
        debug('Perform IAM cookie based user login.');
        self._client({
          url: self._sessionUrl,
          method: 'POST',
          form: { 'access_token': accessToken },
          jar: self._jar,
          json: true
        }, (error, response, body) => {
          if (error) {
            callback(error);
          } else if (response.statusCode === 200) {
            debug('Successfully renewed IAM session.');
            callback(null, response);
          } else {
            let msg = `Failed to exchange IAM token with Cloudant. Status code: ${response.statusCode}`;
            callback(new Error(msg), response);
          }
        });
      }
    ], (error, responses) => {
      done(error, responses[responses.length - 1]);
    });
  }

  setIamApiKey(newIamApiKey) {
    this._iamApiKey = newIamApiKey;
    this.attemptTokenRenewal = true;
  }
}

module.exports = IAMTokenManager;
