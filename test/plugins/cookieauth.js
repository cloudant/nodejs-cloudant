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
const nock = require('../nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const BAD_PASSWORD = 'bAD-Pa$$w0rd123';
const SERVER = `https://${ME}.cloudant.com`;
const SERVER_WITH_CREDS = `https://${ME}:${PASSWORD}@${ME}.cloudant.com`;
const SERVER_WITH_BAD_CREDS = `https://${ME}:${BAD_PASSWORD}@${ME}.cloudant.com`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

// mock cookies

const MOCK_COOKIE = 'AuthSession=Y2xbZWr0bQlpcc19ZQN8OeU4OWFCNYcZOxgdhy-QRDp4i6JQrfkForX5OU5P';
const MOCK_SET_COOKIE_HEADER = { 'set-cookie': `${MOCK_COOKIE}; Version=1; Max-Age=86400; Path=/; HttpOnly` };

const MOCK_COOKIE_2 = 'AuthSession=Q2fbIWc0kQspdc39OQL89eS4PWECcYEZDxgdgy-0RCp2i0dcrDkfoWX7OI5A';
const MOCK_SET_COOKIE_HEADER_2 = { 'set-cookie': `${MOCK_COOKIE_2}; Version=1; Max-Age=86400; Path=/; HttpOnly` };

describe('CookieAuth Plugin', function() {
  before(function(done) {
    var mocks = nock(SERVER)
        .put(DBNAME)
        .reply(201, {ok: true});

    var cloudantClient = new Client();

    var req = {
      url: SERVER_WITH_CREDS + DBNAME,
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
      url: SERVER_WITH_CREDS + DBNAME,
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
    it('performs request and returns 200 response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('performs multiple requests that return 200 responses with only a single session request', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER);
      if (!process.env.NOCK_OFF) {
        mocks
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .times(2)
          .reply(200, {doc_count: 0});
      }

      var end1 = false;
      var end2 = false;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        end1 = true;
        if (end2) {
          mocks.done();
          done();
        }
      });

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        end2 = true;
        if (end1) {
          mocks.done();
          done();
        }
      });
    });

    it('performs request and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        assert.equal(resp.statusCode, 500);
        assert.ok(data.indexOf('"error":"internal_server_error"') > -1);
        mocks.done();
        done();
      });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err.code, 'ECONNRESET');
        assert.equal(err.message, 'socket hang up');
        mocks.done();
        done();
      });
    });

    it('retries session post on 500 and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('retries session post on error and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('returns client 401 response on authentication retry failure', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 401);
        assert.ok(data.indexOf('"error":"unauthorized"') > -1);
        mocks.done();
        done();
      });
    });

    it('retries session post with new credentials and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: BAD_PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({
        username: ME,
        password: BAD_PASSWORD,
        plugins: 'cookieauth'
      });

      var req1 = { url: SERVER_WITH_BAD_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req1, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 401);
        assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);

        var req2 = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
        cloudantClient.request(req2, function(err, resp, data) {
          assert.equal(err, null);
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
          assert.ok(data.indexOf('"doc_count":0') > -1);
          mocks.done();
          done();
        });
      });
    });

    it('returns 200 response on authentication retry success', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .times(2)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });

    it('renews authentication token on 401 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER_2)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE_2);
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
        mocks.done();
        done();
      });
    });
  });

  describe('with listener only', function() {
    it('performs request and returns 200 response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('performs multiple requests that return 200 responses with only a single session request', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER);
      if (!process.env.NOCK_OFF) {
        mocks
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .times(2)
          .reply(200, {doc_count: 0});
      }

      var end1 = false;
      var end2 = false;

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          end1 = true;
          if (end2) {
            assert.equal(responseCount, 2);
            assert.equal(dataCount, 2);
            mocks.done();
            done();
          }
        });

      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          end2 = true;
          if (end1) {
            assert.equal(responseCount, 2);
            assert.equal(dataCount, 2);
            mocks.done();
            done();
          }
        });
    });

    it('performs request and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          assert.equal(resp.statusCode, 500);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"internal_server_error"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
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

    it('retries session post on 500 and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('retries session post on error and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('returns client 401 response on authentication retry failure', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 401);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('retries session post with new credentials and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: BAD_PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({
        username: ME,
        password: BAD_PASSWORD,
        plugins: 'cookieauth'
      });

      var dataCount = 0;
      var responseCount = 0;

      var req1 = { url: SERVER_WITH_BAD_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req1)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 401);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
        })
        .on('end', function() {
          var req2 = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
          cloudantClient.request(req2)
            .on('error', function(err) {
              assert.fail(`Unexpected error: ${err}`);
            })
            .on('response', function(resp) {
              responseCount++;
              if (!process.env.NOCK_OFF) {
                assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
              }
              assert.equal(resp.request.uri.auth, null);
              assert.equal(resp.statusCode, 200);
            })
            .on('data', function(data) {
              dataCount++;
              assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
            })
            .on('end', function() {
              assert.equal(responseCount, 2);
              assert.equal(dataCount, 2);
              mocks.done();
              done();
            });
        });
    });

    it('returns 200 response on authentication retry success', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .times(2)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('renews authentication token on 401 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER_2)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req)
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE_2);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });
  });

  describe('with callback and listener', function() {
    it('performs request and returns 200 response', function(done) {
      // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('performs request and returns 500 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        assert.equal(resp.statusCode, 500);
        assert.ok(data.indexOf('"error":"internal_server_error"') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          assert.equal(resp.statusCode, 500);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"internal_server_error"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('performs request and returns error', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
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

    it('retries session post on 500 and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('retries session post on error and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('returns client 401 response on authentication retry failure', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 401);
        assert.ok(data.indexOf('"error":"unauthorized"') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 401);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('retries session post with new credentials and returns 200 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: BAD_PASSWORD})
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var cloudantClient = new Client({
        username: ME,
        password: BAD_PASSWORD,
        plugins: 'cookieauth'
      });

      var dataCount = 0;
      var responseCount = 0;

      var req1 = { url: SERVER_WITH_BAD_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req1, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 401);
        assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          assert.equal(resp.statusCode, 401);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"error":"unauthorized"') > -1);
        })
        .on('end', function() {
          var req2 = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
          cloudantClient.request(req2, function(err, resp, data) {
            assert.equal(err, null);
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
            assert.equal(resp.request.uri.auth, null);
            assert.equal(resp.statusCode, 200);
            assert.ok(data.indexOf('"doc_count":0') > -1);
          })
            .on('error', function(err) {
              assert.fail(`Unexpected error: ${err}`);
            })
            .on('response', function(resp) {
              responseCount++;
              if (!process.env.NOCK_OFF) {
                assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
              }
              assert.equal(resp.request.uri.auth, null);
              assert.equal(resp.statusCode, 200);
            })
            .on('data', function(data) {
              dataCount++;
              assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
            })
            .on('end', function() {
              assert.equal(responseCount, 2);
              assert.equal(dataCount, 2);
              mocks.done();
              done();
            });
        });
    });

    it('returns 200 response on authentication retry success', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .times(2)
          .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });

    it('renews authentication token on 401 response', function(done) {
      if (process.env.NOCK_OFF) {
        this.skip();
      }

      var mocks = nock(SERVER)
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER)
          .get(DBNAME)
          .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
          .post('/_session', {name: ME, password: PASSWORD})
          .reply(200, {ok: true}, MOCK_SET_COOKIE_HEADER_2)
          .get(DBNAME)
          .reply(200, {doc_count: 0});

      var dataCount = 0;
      var responseCount = 0;

      var cloudantClient = new Client({ plugins: 'cookieauth' });
      var req = { url: SERVER_WITH_CREDS + DBNAME, method: 'GET' };
      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        if (!process.env.NOCK_OFF) {
          assert.equal(resp.request.headers.cookie, MOCK_COOKIE_2);
        }
        assert.equal(resp.request.uri.auth, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);
      })
        .on('error', function(err) {
          assert.fail(`Unexpected error: ${err}`);
        })
        .on('response', function(resp) {
          responseCount++;
          if (!process.env.NOCK_OFF) {
            assert.equal(resp.request.headers.cookie, MOCK_COOKIE_2);
          }
          assert.equal(resp.request.uri.auth, null);
          assert.equal(resp.statusCode, 200);
        })
        .on('data', function(data) {
          dataCount++;
          assert.ok(data.toString('utf8').indexOf('"doc_count":0') > -1);
        })
        .on('end', function() {
          assert.equal(responseCount, 1);
          assert.equal(dataCount, 1);
          mocks.done();
          done();
        });
    });
  });
});
