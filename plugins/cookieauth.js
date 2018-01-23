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

const debug = require('debug')('cloudant:plugins:cookieauth');
const request = require('request');
const u = require('url');

const BasePlugin = require('./base.js');

/**
 * Cookie Authentication plugin.
 */
class CookiePlugin extends BasePlugin {
  constructor(client, cfg) {
    super(client, cfg);

    var self = this;
    self.baseUrl = null;
    self.cookieJar = request.jar();
    self.credentials = {};
    self.useCookieAuth = true;
  }

  // Compare `newCredentials` to credentials currently being stored by the
  // client.
  isNewCredentials(newCredentials) {
    return newCredentials.username !== this.credentials.username ||
           newCredentials.password !== this.credentials.password;
  }

  onRequest(state, req, callback) {
    var self = this;

    // set stash defaults
    if (typeof state.stash.useCookieAuth === 'undefined') {
      state.stash.useCookieAuth = true;
    }
    if (typeof state.stash.forceRenewCookie === 'undefined') {
      state.stash.forceRenewCookie = false;
    }

    // Cookie renewal flags:
    //
    // - `useCookieAuth`
    //     `true`  => Allow cookie session authentication attempts.
    //     `false` => Implies a cookie session authentication attempt has failed
    //                with a non-200 response. No further attempts can be made
    //                unless different credentials are used.
    //
    // - `forceRenewCookie`
    //     `true`  => Renew the session cookie.
    //     `false` => Only renew the session cookie if there isn't a valid
    //                cookie already in the cookie jar.

    if (!state.stash.useCookieAuth) {
      // another plugin has requested a retry. a previous session cookie request
      // attempt failed for these credentials. we don't try again.
      debug('Skipping session cookie authentication.');
      return callback(state);
    }

    req.url = req.uri || req.url;
    delete req.uri;

    var parsed = u.parse(req.url);
    var auth = parsed.auth;

    delete parsed.auth;
    delete parsed.href;

    if (!auth) {
      debug('Missing credentials - skipping cookie authentication.');
      state.stash.credentials = null;
      return callback(state);
    }

    var bits = auth.split(':');
    var urlCredentials = {username: bits[0], password: bits[1]};
    state.stash.credentials = urlCredentials;

    if (!self.isNewCredentials(state.stash.credentials)) {
      if (!self.useCookieAuth) {
        // don't acquire session cookie as previous attempt failed
        debug('Skipping session cookie authentication.');
        return callback(state);
      }
      if (!state.stash.forceRenewCookie) {
        if (self.baseUrl && self.cookieJar.getCookies(self.baseUrl, {expire: true}).length > 0) {
          debug('There is already a valid session cookie in the jar.');
          req.jar = self.cookieJar;
          req.url = u.format(parsed); // remove credentials from request
          return callback(state);
        }
      }
    }

    self.baseUrl = u.format({
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port
    });

    self.refreshCookie(state, function(error) {
      if (error) {
        debug(error.message);
      } else {
        req.url = u.format(parsed); // remove credentials from request
        req.jar = self.cookieJar; // add jar
      }
      callback(state);
    });
  }

  onResponse(state, response, callback) {
    if (state.stash.useCookieAuth && state.stash.credentials && response.statusCode === 401) {
      var newCredentials = this.isNewCredentials(state.stash.credentials);

      // Note: Using `this.useCookieAuth` is only applicable when we have
      //       matching credentials. If not, the client has changed the
      //       credentials and a new session cookie request should be made.

      if (newCredentials || (!newCredentials && this.useCookieAuth)) {
        state.stash.forceRenewCookie = true;
        state.retry = true;
      } else {
        debug(`Not renewing session cookie for unauthorized response code.`);
      }
    }
    callback(state);
  }

  // Perform cookie session request.
  refreshCookie(state, callback) {
    var self = this;

    self.withLock({
      stale: self._cfg.cookieLockStaleMsecs || 1500, // 1.5 secs
      wait: self._cfg.cookieLockWaitMsecs || 1000 // 1 sec
    }, function(error, done) {
      if (error) {
        debug(`Failed to acquire lock: ${error}`); // refresh cookie without lock
      }
      if (self.isNewCredentials(state.stash.credentials)) {
        debug('New credentials identified. Renewing session cookie...');
      } else {
        if (!self.useCookieAuth) {
          return callback(new Error('Skipping session cookie authentication'));
        }
        if (!state.stash.forceRenewCookie) {
          if (self.baseUrl && self.cookieJar.getCookies(self.baseUrl, {expire: true}).length > 0) {
            debug('There is already a valid session cookie in the jar.');
            return callback();
          }
        }
      }
      debug('Making cookie session request.');
      self._client({
        url: self.baseUrl + '/_session',
        method: 'POST',
        jar: self.cookieJar,
        form: {
          name: state.stash.credentials.username,
          password: state.stash.credentials.password
        }
      }, function(error, response, body) {
        if (error || response.statusCode >= 500) {
          state.retry = true;
          callback(new Error('Failed to acquire session cookie. Attempting retry...'));
        } else if (response.statusCode !== 200) {
          // setting `state.stash.useCookieAuth = false` will ensure the
          // `onResponse` hook doesn't retry the request
          self.useCookieAuth = state.stash.useCookieAuth = false;
          callback(new Error(`Failed to acquire session cookie. Status code: ${response.statusCode}`));
        } else {
          debug('Successfully acquired session cookie.');
          self.credentials = state.stash.credentials;  // store client credentials
          self.useCookieAuth = true;
          callback();
        }
        done();
      });
    });
  }
}

CookiePlugin.id = 'cookieauth';

module.exports = CookiePlugin;
