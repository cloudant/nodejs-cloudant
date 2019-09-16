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

const Mutex = require('../lib/mutex');

describe('Mutex', function() {
  it('can acquire the mutex', function(done) {
    var m = new Mutex();
    m.lock(1, (err) => {
      assert.ok(m.isLocked);
      m.unlock();
      assert.ok(m.isLocked === false);
      done(err);
    });
  });

  it('can unlock a mutex multiple times without error', function(done) {
    var m = new Mutex();
    m.lock(1, (err) => {
      assert.ok(m.isLocked);
      m.unlock();
      assert.ok(m.isLocked === false);
      m.unlock();
      assert.ok(m.isLocked === false);
      m.unlock();
      assert.ok(m.isLocked === false);
      done(err);
    });
  });

  it('times out correctly when attempting to acquire a busy lock', function(done) {
    var acquireTimedOut = false;
    var m = new Mutex();

    m.lock(1, (err) => {
      assert.ok(m.isLocked);
      setTimeout(() => {
        assert.ok(acquireTimedOut);
        assert.ok(m.isLocked);
        m.unlock();
        assert.ok(m.isLocked === false);
        done(err);
      }, 500);
    });

    m.lock(250, (err) => {
      assert.equal(err.message, 'Timed out acquiring lock.');
      acquireTimedOut = true;
    });
  });

  it('waits correctly when attempting to acquire a busy lock', function(done) {
    var acquiredLockCount = 0;
    var m = new Mutex();

    var startTs = (new Date()).getTime();

    // make 100 lock acquires
    for (let i = 1; i < 101; i++) {
      if (i === 100) { // last lock
        m.lock(15 * i, (err) => {
          assert.ifError(err);
          assert.ok(m.isLocked);
          acquiredLockCount += 1;
          setTimeout(() => {
            assert.ok(m.isLocked);
            m.unlock();
            assert.ok(m.isLocked === false);
            assert.equal(acquiredLockCount, 100);
            let now = (new Date()).getTime();
            assert.ok(now - startTs > 1000); // 100 locks * 10ms
            done();
          }, 10);
        });
      } else {
        m.lock(15 * i, (err) => {
          assert.ifError(err);
          assert.ok(m.isLocked);
          acquiredLockCount += 1;
          setTimeout(() => {
            assert.ok(m.isLocked);
            m.unlock();
            assert.ok(m.isLocked); // the wait array is not empty
          }, 10);
        });
      }
    }
  });
});
