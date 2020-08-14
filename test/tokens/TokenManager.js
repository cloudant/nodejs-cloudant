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

/* global describe it */
'use strict';

const assert = require('assert');

const TokenManager = require('../../lib/tokens/TokenManager');

class TokenManagerRenewSuccess extends TokenManager {
  constructor() {
    super();
    this._getTokenCallCount = 0;
    this._cookieHeader = 'Max-Age=1';
  }

  _getToken(callback) {
    this._getTokenCallCount += 1;
    setTimeout(() => {
      callback(null, { headers: { 'set-cookie': [ this._cookieHeader ] } });
    }, 100);
  }

  // mock successful token renewal
  get getTokenCallCount() {
    return this._getTokenCallCount;
  }

  get cookieHeader() {
    return this._cookieHeader;
  }

  set cookieHeader(cookieHeader) {
    this._cookieHeader = cookieHeader;
  }
}

class TokenManagerRenewFailure extends TokenManager {
  constructor() {
    super();
    this._getTokenCallCount = 0;
  }

  // mock failed token renewal
  _getToken(callback) {
    this._getTokenCallCount += 1;
    setTimeout(() => {
      callback(new Error('err'), {ok: false});
    }, 100);
  }

  get getTokenCallCount() {
    return this._getTokenCallCount;
  }
}

describe('Token Manger', (done) => {
  it('renews the token successfully', (done) => {
    let t = new TokenManagerRenewSuccess();
    t.renewIfRequired().then(() => {
      assert.equal(t.getTokenCallCount, 1);
      done();
    }).catch(done);
    assert.ok(t.isTokenRenewing);
  });

  it('handles a token renewal failure', (done) => {
    let t = new TokenManagerRenewFailure();
    t.renewIfRequired().then(() => {
      assert.fail('Unexpected success.');
    }).catch((error) => {
      assert.equal(t.getTokenCallCount, 1);
      assert.equal(error.message, 'err');
      assert.equal(error.response.ok, false);
      done();
    });
    assert.ok(t.isTokenRenewing);
  });

  it('correctly auto renews token', (done) => {
    let t = new TokenManagerRenewSuccess();
    t.startAutoRenew();
    setTimeout(() => {
      // one renew every 0.5 seconds
      assert.equal(t.getTokenCallCount, 4);
      done();
    }, 2000);
  });

  it('correctly auto renews token in the absence of a cookie Max-Age', (done) => {
    let t = new TokenManagerRenewSuccess();
    t.cookieHeader = '';
    t.startAutoRenew(2);
    setTimeout(() => {
      // one renew every 1 seconds
      assert.equal(t.getTokenCallCount, 2);
      done();
    }, 2000);
  });

  it('only makes one renewal request', (done) => {
    let t = new TokenManagerRenewSuccess();
    let renewalCount = 0;
    let lim = 10000;

    for (let i = 1; i < lim + 1; i++) {
      if (i === lim) {
        t.renewIfRequired().then(() => {
          renewalCount += 1;
          assert.equal(renewalCount, lim);
          assert.equal(t.getTokenCallCount, 1);
          done();
        }).catch(done);
      } else {
        t.renewIfRequired().then(() => {
          renewalCount += 1;
        }).catch(done);
      }
    }
    assert.ok(t.isTokenRenewing);
  });

  it('makes another renewal only after setting force renew', (done) => {
    let t = new TokenManagerRenewSuccess();
    // renew 1 - make request
    t.renewIfRequired().then(() => {
      assert.equal(t.getTokenCallCount, 1);
      // renew 2 - return last good response
      t.renewIfRequired().then(() => {
        assert.equal(t.getTokenCallCount, 1);
        t.attemptTokenRenewal = true;
        // renew 3 - make request
        t.renewIfRequired().then(() => {
          assert.equal(t.getTokenCallCount, 2);
          done();
        });
      });
    }).catch(done);
    assert.ok(t.isTokenRenewing);
  });
});
