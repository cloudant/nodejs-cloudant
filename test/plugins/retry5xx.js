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

/* global describe it before after */
'use strict';

const assert = require('assert');
const Client = require('../../lib/client.js');
const fs = require('fs');
const nock = require('../nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = 'https://' + ME + '.cloudant.com';
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

describe('Retry5xx Plugin', function() {
  before(function(done) {
    var mocks = nock(SERVER)
        .put(DBNAME)
        .reply(201, {ok: true});

    var cloudantClient = new Client();

    var req = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'PUT'
    };
    cloudantClient.request(req, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 201);
      mocks.done();
      done();
    });
  });

  after(function(done) {
    var mocks = nock(SERVER)
        .delete(DBNAME)
        .reply(200, {ok: true});

    var cloudantClient = new Client();

    var req = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'DELETE'
    };
    cloudantClient.request(req, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
      mocks.done();
      done();
    });
  });

  describe('with callback only', function() {
    it('performs request and returns response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client();
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');
        mocks.done();
        done();
      });
    });

    it('successfully retries request on 500 response and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });

      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        // validate retry delay
        var now = (new Date()).getTime();
        assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

        mocks.done();
        done();
      });
    });

    it('fails to retry request on 500 response and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');

        // validate retry delay
        var now = (new Date()).getTime();
        assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

        mocks.done();
        done();
      });
    });

    it('fails to retry request on 500 response and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(5)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 500);
        assert.ok(data.indexOf('"error":"internal_server_error"') > -1);

        // validate retry delay
        var now = (new Date()).getTime();
        assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

        mocks.done();
        done();
      });
    });
  });

  describe('with listener only', function() {
    it('performs request and returns response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var dataFile = fs.createWriteStream('data.json');

      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
        })
        .pipe(dataFile)
        .on('finish', function() {
          // validate file contents
          var obj = JSON.parse(fs.readFileSync('data.json', 'utf8'));
          assert.equal(obj.doc_count, 0);
          fs.unlinkSync('data.json');

          mocks.done();
          done();
        });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client();
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      cloudantClient.request(req)
        .on('error', function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');
          mocks.done();
          done();
        })
        .on('response', function(resp) {
          assert.fail('Unexpected response from server');
        })
        .on('data', function(data) {
          assert.fail('Unexpected data from server');
        });
    });

    it('successfully retries request on 500 response and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var dataFile = fs.createWriteStream('data.json');

      var startTs = (new Date()).getTime();
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));
        })
        .pipe(dataFile)
        .on('finish', function() {
          // validate file contents
          var obj = JSON.parse(fs.readFileSync('data.json', 'utf8'));
          assert.equal(obj.doc_count, 0);
          fs.unlinkSync('data.json');

          mocks.done();
          done();
        });
    });

    it('fails to retry request on 500 response and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var startTs = (new Date()).getTime();
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

          mocks.done();
          done();
        })
        .on('response', function(resp) {
          assert.fail('Unexpected response from server');
        })
        .on('data', function(data) {
          assert.fail('Unexpected data from server');
        });
    });

    it('fails to retry request on 500 response and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(5)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var startTs = (new Date()).getTime();
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 500);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"internal_server_error"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

          mocks.done();
          done();
        });
    });
  });

  describe('with callback and listener', function() {
    it('performs request and returns response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var dataFile = fs.createWriteStream('data.json');

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
        })
        .pipe(dataFile)
        .on('finish', function() {
          // validate file contents
          var obj = JSON.parse(fs.readFileSync('data.json', 'utf8'));
          assert.equal(obj.doc_count, 0);
          fs.unlinkSync('data.json');

          mocks.done();
          done();
        });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client();
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');
      })
        .on('error', function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');
          mocks.done();
          done();
        })
        .on('response', function(resp) {
          assert.fail('Unexpected response from server');
        })
        .on('data', function(data) {
          assert.fail('Unexpected data from server');
        });
    });

    it('successfully retries request on 500 response and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var dataFile = fs.createWriteStream('data.json');

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));
        })
        .pipe(dataFile)
        .on('finish', function() {
          // validate file contents
          var obj = JSON.parse(fs.readFileSync('data.json', 'utf8'));
          assert.equal(obj.doc_count, 0);
          fs.unlinkSync('data.json');

          mocks.done();
          done();
        });
    });

    it('fails to retry request on 500 response and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(4)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');
      })
        .on('error', function(err) {
          assert.equal(err.code, 'ECONNRESET');
          assert.equal(err.message, 'socket hang up');

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

          mocks.done();
          done();
        })
        .on('response', function(resp) {
          assert.fail('Unexpected response from server');
        })
        .on('data', function(data) {
          assert.fail('Unexpected data from server');
        });
    });

    it('fails to retry request on 500 response and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .get(DBNAME).times(5)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var cloudantClient = new Client({ maxAttempt: 5, plugin: 'retry5xx' });
      var req = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };

      var dataCount = 0;
      var responseCount = 0;

      var startTs = (new Date()).getTime();
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 500);
        assert.ok(data.indexOf('"error":"internal_server_error"') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 500);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"internal_server_error"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);

          // validate retry delay
          var now = (new Date()).getTime();
          assert.ok(now - startTs > (500 + 1000 + 2000 + 4000));

          mocks.done();
          done();
        });
    });
  });
});
