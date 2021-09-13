// Copyright © 2019, 2021 IBM Corp. All rights reserved.
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

const debug = require('debug')('cloudant:tokens:tokenmanager');
const cookie = require('cookie');
const EventEmitter = require('events');

class TokenManager {
  constructor(client, jar, sessionUrl) {
    this._client = client;
    this._jar = jar;
    this._sessionUrl = sessionUrl;

    this._attemptTokenRenewal = true;
    this._isTokenRenewing = false;

    this._tokenExchangeEE = new EventEmitter().setMaxListeners(Infinity);

    // START monkey patch for https://github.com/salesforce/tough-cookie/issues/154
    // Use the tough-cookie CookieJar from the RequestJar
    const cookieJar = this._jar ? this._jar._jar : false;
    // Check if we've already patched the jar
    if (cookieJar && !cookieJar.cloudantPatch) {
      // Set the patching flag
      cookieJar.cloudantPatch = true;
      // Replace the store's updateCookie function with one that applies a patch to newCookie
      const originalUpdateCookieFn = cookieJar.store.updateCookie;
      cookieJar.store.updateCookie = function(oldCookie, newCookie, cb) {
        // Add current time as an update timestamp to the newCookie
        newCookie.cloudantPatchUpdateTime = new Date();
        // Replace the cookie's expiryTime function with one that uses cloudantPatchUpdateTime
        // in place of creation time to check the expiry.
        const originalExpiryTimeFn = newCookie.expiryTime;
        newCookie.expiryTime = function(now) {
          // The original expiryTime check is relative to a time in this order:
          // 1. supplied now argument
          // 2. this.creation (original cookie creation time)
          // 3. current time
          // This patch replaces 2 with an expiry check relative to the cloudantPatchUpdateTime if set instead of
          // the creation time by passing it as the now argument.
          return originalExpiryTimeFn.call(
            newCookie,
            newCookie.cloudantPatchUpdateTime || now
          );
        };
        // Finally delegate back to the original update function or the fallback put (which is set by Cookie
        // when an update function is not present on the store). Since we always set an update function for our
        // patch we need to also provide that fallback.
        if (originalUpdateCookieFn) {
          originalUpdateCookieFn.call(
            cookieJar.store,
            oldCookie,
            newCookie,
            cb
          );
        } else {
          cookieJar.store.putCookie(newCookie, cb);
        }
      };
    }
    // END cookie jar monkey patch
  }

  _autoRenew(defaultMaxAgeSecs) {
    debug('Auto renewing token now...');
    this._renew().then((response) => {
      let setCookieHeader = response.headers['set-cookie'];
      let headerValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      let maxAgeSecs = cookie.parse(headerValue)['Max-Age'] || defaultMaxAgeSecs;
      let delayMSecs = maxAgeSecs / 2 * 1000;
      debug(`Renewing token in ${delayMSecs} milliseconds.`);
      setTimeout(this._autoRenew.bind(this, defaultMaxAgeSecs), delayMSecs).unref();
    }).catch((error) => {
      debug(`Failed to auto renew token - ${error}. Retrying in 60 seconds.`);
      setTimeout(this._autoRenew.bind(this), 60000).unref();
    });
  }

  _getToken(callback) {
    // ** Method to be implemented by _all_ subclasses of `TokenManager` **
    throw new Error('Not implemented.');
  }

  // Renew the token.
  _renew() {
    if (!this._isTokenRenewing) {
      this._isTokenRenewing = true;
      this._tokenExchangeEE.removeAllListeners();
      debug('Starting token renewal.');
      this._getToken((error, response) => {
        if (error) {
          this._tokenExchangeEE.emit('error', error, response);
        } else {
          this._tokenExchangeEE.emit('success', response);
          this._attemptTokenRenewal = false;
        }
        debug('Finished token renewal.');
        this._isTokenRenewing = false;
      });
    }
    return new Promise((resolve, reject) => {
      this._tokenExchangeEE.once('success', resolve);
      this._tokenExchangeEE.once('error', (error, response) => {
        error.response = response;
        reject(error);
      });
    });
  }

  // Getter for `attemptTokenRenewal`.
  // - `true`  A renewal attempt will be made on the next `renew` request.
  // - `false` No renewal attempt will be made on the next `renew`
  //           request. Instead the last good renewal response will be returned
  //           to the client.
  get attemptTokenRenewal() {
    return this._attemptTokenRenewal;
  }

  // Getter for `isTokenRenewing`.
  // - `true`  A renewal attempt is in progress.
  // - `false` There are no in progress renewal attempts.
  get isTokenRenewing() {
    return this._isTokenRenewing;
  }

  // Settter for `attemptTokenRenewal`.
  set attemptTokenRenewal(newAttemptTokenRenewal) {
    this._attemptTokenRenewal = newAttemptTokenRenewal;
  }

  // Renew the token if `attemptTokenRenewal` is `true`. Otherwise this is a
  // no-op so just resolve the promise.
  renewIfRequired() {
    if (this._attemptTokenRenewal) {
      return this._renew();
    } else {
      return new Promise((resolve) => {
        resolve();
      });
    }
  }

  // Start the auto renewal timer.
  startAutoRenew(defaultMaxAgeSecs) {
    this._autoRenew(defaultMaxAgeSecs || 3600);
  }
}

module.exports = TokenManager;
