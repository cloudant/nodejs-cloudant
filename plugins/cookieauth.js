// Copyright © 2015, 2021 IBM Corp. All rights reserved.
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

const debug = require('debug')('cloudant:plugins:cookieauth');
const request = require('request');
const u = require('url');

const BasePlugin = require('./base');
const CookieTokenManager = require('../lib/tokens/CookieTokenManager');

/**
 * Cookie Authentication plugin.
 */
class CookiePlugin extends BasePlugin {
  constructor(client, cfg) {
    cfg = Object.assign({
      autoRenew: true,
      errorOnNoCreds: true
    }, cfg);

    super(client, cfg);

    let sessionUrl = new u.URL(cfg.serverUrl);
    sessionUrl.pathname = '/_session';
    if (!sessionUrl.username || !sessionUrl.password) {
      if (cfg.errorOnNoCreds) {
        throw new Error('Credentials are required for cookie authentication.');
      }
      debug('Missing credentials for cookie authentication. Permanently disabling plugin.');
      this.disabled = true;
      return;
    }

    this._jar = request.jar();

    this._tokenManager = new CookieTokenManager(
      client,
      this._jar,
      u.format(sessionUrl, {auth: false}),
      // Extract creds from URL and decode
      decodeURIComponent(sessionUrl.username),
      decodeURIComponent(sessionUrl.password)
    );

    if (cfg.autoRenew) {
      this._tokenManager.startAutoRenew(cfg.autoRenewDefaultMaxAgeSecs);
    }
  }

  onRequest(state, req, callback) {
    var self = this;

    req.jar = self._jar;

    req.uri = req.uri || req.url;
    delete req.url;
    req.uri = u.format(new u.URL(req.uri), {auth: false});

    self._tokenManager.renewIfRequired().catch((error) => {
      if (state.attempt < state.maxAttempt) {
        state.retry = true;
      } else {
        state.abortWithResponse = [ error ]; // return error to client
      }
    }).finally(() => callback(state));
  }

  onResponse(state, response, callback) {
    if (response.statusCode === 401) {
      debug('Received 401 response. Asking for request retry.');
      state.retry = true;
      this._tokenManager.attemptTokenRenewal = true;
    }
    callback(state);
  }
}

CookiePlugin.id = 'cookieauth';

module.exports = CookiePlugin;
