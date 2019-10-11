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

const debug = require('debug')('cloudant:plugins:iamauth');
const request = require('request');
const u = require('url');

const BasePlugin = require('./base.js');
const IAMTokenManager = require('../lib/tokens/IamTokenManager');

/**
 * IAM Authentication plugin.
 */
class IAMPlugin extends BasePlugin {
  constructor(client, cfg) {
    if (typeof cfg.iamApiKey === 'undefined') {
      throw new Error('Missing IAM API key from configuration');
    }

    cfg = Object.assign({
      autoRenew: true,
      iamTokenUrl: 'https://iam.cloud.ibm.com/identity/token',
      retryDelayMsecs: 1000
    }, cfg);

    super(client, cfg);

    let sessionUrl = new u.URL(cfg.serverUrl);
    sessionUrl.pathname = '/_iam_session';

    this._jar = request.jar();

    this._tokenManager = new IAMTokenManager(
      client,
      this._jar,
      u.format(sessionUrl, {auth: false}),
      cfg.iamTokenUrl,
      cfg.iamApiKey,
      cfg.iamClientId,
      cfg.iamClientSecret
    );

    if (cfg.autoRenew) {
      this._tokenManager.startAutoRenew();
    }
  }

  onRequest(state, req, callback) {
    var self = this;

    req.jar = self._jar;

    req.uri = req.uri || req.url;
    delete req.url;
    req.uri = u.format(new u.URL(req.uri), {auth: false});

    self._tokenManager.renewIfRequired().then(() => {
      callback(state);
    }).catch((error) => {
      debug(error);
      if (state.attempt < state.maxAttempt) {
        state.retry = true;
        let iamResponse = error.response;
        let retryAfterSecs;
        if (iamResponse && iamResponse.headers) {
          retryAfterSecs = iamResponse.headers['Retry-After'];
        }
        if (retryAfterSecs) {
          state.retryDelayMsecs = retryAfterSecs * 1000;
        } else {
          state.retryDelayMsecs = self._cfg.retryDelayMsecs;
        }
      } else {
        state.abortWithResponse = [ error ]; // return error to client
      }
      callback(state);
    });
  }

  onResponse(state, response, callback) {
    if (response.statusCode === 401) {
      debug('Received 401 response. Asking for request retry.');
      state.retry = true;
      this._tokenManager.attemptTokenRenewal = true;
    }
    callback(state);
  }

  setIamApiKey(newIamApiKey) {
    this._tokenManager.setIamApiKey(newIamApiKey);
  }
}

IAMPlugin.id = 'iamauth';

module.exports = IAMPlugin;
