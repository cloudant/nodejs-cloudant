// Copyright © 2017, 2021 IBM Corp. All rights reserved.
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

/* global describe it before beforeEach after */
'use strict';

const assert = require('assert');
const Client = require('../../lib/client.js');
const Cloudant = require('../../cloudant.js');
const nock = require('../nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const IAM_API_KEY = process.env.cloudant_iam_api_key || 'CqbrIYzdO3btWV-5t4teJLY_etfT_dkccq-vO-5vCXSo';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const SERVER_NO_PROTOCOL = SERVER.replace(/^https?:\/\//, '');
const SERVER_WITH_CREDS = `https://${ME}:${PASSWORD}@${SERVER_NO_PROTOCOL}`;
const TOKEN_SERVER = process.env.cloudant_iam_token_server || 'https://iam.cloud.ibm.com';
const TOKEN_SERVER_URL = `${TOKEN_SERVER}/identity/token`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

// mocks
const MOCK_TOKEN_SERVER_USER = 'ASPialYTheOS';
const MOCK_TOKEN_SERVER_PASS = 'Zr28yT54^y!Kk&$M';
const MOCK_ACCESS_TOKEN = 'eyJraWQiOiIyMDE3MDQwMi0wMDowMDowMCIsImFsZyI6IlJTMj' +
'U2In0.eeyJraWQiOiIyMDE3MDQwMi0wMDowMDowMCIsImFsZyI6IlJTMjU2In0.eyJpYW1faWQiO' +
'iJJQk1pZC0yNzAwMDdHRjBEIiwiaWQiOiJJQk1pZC0yNzAwMDdHRjBEIiwicmVhbG1pZCI6IklCT' +
'WlkIiwiaWRlbnRpZmllciI6IjI3MDAwN0dGMEQiLCJnaXZlbl9uYW1lIjoiVG9tIiwiZmFtaWx5X' +
'25hbWUiOiJCbGVuY2giLCJuYW1lIjoiVG9tIEJsZW5jaCIsImVtYWlsIjoidGJsZW5jaEB1ay5pY' +
'm0uY29tIiwic3ViIjoidGJsZW5jaEB1ay5pYm0uY29tIiwiYWNjb3VudCI6eyJic3MiOiI1ZTM1Z' +
'TZhMjlmYjJlZWNhNDAwYWU0YzNlMWZhY2Y2MSJ9LCJpYXQiOjE1MDA0NjcxMDIsImV4cCI6MTUwM' +
'DQ3MDcwMiwiaXNzIjoiaHR0cHM6Ly9pYW0ubmcuYmx1ZW1peC5uZXQvb2lkYy90b2tlbiIsImdyY' +
'W50X3R5cGUiOiJ1cm46aWJtOnBhcmFtczpvYXV0aDpncmFudC10eXBlOmFwaWtleSIsInNjb3BlI' +
'joib3BlbmlkIiwiY2xpZW50X2lkIjoiZGVmYXVsdCJ9.XAPdb5K4n2nYih-JWTWBGoKkxTXM31c1' +
'BB1g-Ciauc2LxuoNXVTyz_mNqf1zQL07FUde1Cb_dwrbotjickNcxVPost6byQztfc0mRF1x2S6V' +
'R8tn7SGiRmXBjLofkTh1JQq-jutp2MS315XbTG6K6m16uYzL9qfMnRvQHxsZWErzfPiJx-Trg_j7' +
'OX-qNFjdNUGnRpU7FmULy0r7RxLd8mhG-M1yxVzRBAZzvM63s0XXfMnk1oLi-BuUUTqVOdrM0KyY' +
'MWfD0Q72PTo4Exa17V-R_73Nq8VPCwpOvZcwKRA2sPTVgTMzU34max8b5kpTzVGJ6SXSItTVOUdA' +
'ygZBng';
const MOCK_IAM_TOKEN_RESPONSE = {
  'access_token': MOCK_ACCESS_TOKEN,
  'token_type': 'Bearer',
  'expires_in': 3600, // 60mins
  'refresh_token': 'MO61FKNvVRWkSa4vmBZqYv_Jt1kkGMUc-XzTcNnR-GnIhVKXHUWxJVV3R' +
'ddE8Kqh3X_TRddE8Kqh3X_TZRmyK8UySIWKxoJ2t6obUSUalPm90SBpTdoXtaljpNyormqCCYPRO' +
'nk6JBym72ikSJqKHHEZVQkT0B5ggZCwPMnKagFj0ufs-VIhCF97xhDxDKcIPMWG02xxPuESaSTJJ' +
'ug7e_dUDoak_ZXm9xxBmOTRKwOxn5sTKthNyvVpEYPE7jIHeiRdVDOWhN5LomgCn3TqFCLpMErnq' +
'wgNYbyCBd9rNm-alYKDb6Jle4njuIBpXxQPb4euDwLd1osApaSME3nEarFWqRBzhjoqCe1Kv564s' +
'_rY7qzD1nHGvKOdpSa0ZkMcfJ0LbXSQPs7gBTSVrBFZqwlg-2F-U3Cto62-9qRR_cEu_K9ZyVwL4' +
'jWgOlngKmxV6Ku4L5mHp4KgEJSnY_78_V2nm64E--i2ZA1FhiKwIVHDOivVNhggE9oabxg54vd63' +
'glp4GfpNnmZsMOUYG9blJJpH4fDX4Ifjbw-iNBD7S2LRpP8b8vG9pb4WioGzN43lE5CysveKYWrQ' +
'EZpThznxXlw1snDu_A48JiL3Lrvo1LobLhF3zFV-kQ='
};
const MOCK_IAM_SESSION = 'IAMSession=dFNyccpWQd1iZF0zWTCwFDEEFTESPk8X21cygDdoe1RrVNgH7hgfemgOLr5fx_sdje-47o_dpfUgThyybh';
const MOCK_SET_IAM_SESSION_HEADER = {
  'set-cookie': `${MOCK_IAM_SESSION}; Version=1; Max-Age=3599; Secure; Path=/; HttpOnly; Secure`
};
const MOCK_SET_IAM_SESSION_HEADER_SHORT = {
  'set-cookie': `${MOCK_IAM_SESSION}; Version=1; Max-Age=2; Secure; Path=/; HttpOnly; Secure`
};

describe('#db IAMAuth Plugin', function() {
  beforeEach(function() {
    if (process.env.SKIP_IAM_TESTS) {
      this.skip();
    }
  });

  before(function(done) {
    var mocks = nock(SERVER)
      .put(DBNAME)
      .reply(201, {ok: true});

    var cloudantClient = new Client({ plugins: [] });

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

    var cloudantClient = new Client({ plugins: [] });

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

  it('performs request and returns 200 response', function(done) {
    if (process.env.NOCK_OFF && !process.env.cloudant_iam_api_key) {
      this.skip();
    }

    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER_WITH_CREDS }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY, iamTokenUrl: TOKEN_SERVER_URL } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      if (!process.env.NOCK_OFF) {
        assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      }
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('performs request and returns 200 response when authenticating with IAM token service', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .basicAuth({ user: MOCK_TOKEN_SERVER_USER, pass: MOCK_TOKEN_SERVER_PASS })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER },
      plugins: { iamauth: {
        autoRenew: false,
        iamApiKey: IAM_API_KEY,
        iamClientId: MOCK_TOKEN_SERVER_USER,
        iamClientSecret: MOCK_TOKEN_SERVER_PASS
      }}});
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      if (!process.env.NOCK_OFF) {
        assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      }
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('performs multiple requests that return 200 responses with only a single session request', function(done) {
    if (process.env.NOCK_OFF && !process.env.cloudant_iam_api_key) {
      this.skip();
    }

    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER);
    if (!process.env.NOCK_OFF) {
      cloudantMocks
        .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
        .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
        .get(DBNAME)
        .times(2)
        .reply(200, {doc_count: 0});
    }

    var end1 = false;
    var end2 = false;

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY, iamTokenUrl: TOKEN_SERVER_URL } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      if (!process.env.NOCK_OFF) {
        assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      }
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);

      end1 = true;
      if (end2) {
        iamMocks.done();
        cloudantMocks.done();
        done();
      }
    });

    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      if (!process.env.NOCK_OFF) {
        assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      }
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);

      end2 = true;
      if (end1) {
        iamMocks.done();
        cloudantMocks.done();
        done();
      }
    });
  });

  it('performs request and returns 500 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      assert.equal(resp.statusCode, 500);
      assert.ok(data.indexOf('"error":"internal_server_error"') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('performs request and returns error', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err.code, 'ECONNRESET');
      assert.equal(err.message, 'socket hang up');
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('iam_session returns error', function() {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(3)
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .times(3)
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

    var cloudantClient = new Cloudant({ url: SERVER, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    return assert.rejects(
      cloudantClient.db.get(DBNAME),
      {
        code: 'ECONNRESET',
        description: 'socket hang up'
      },
      'Should have rejected with a socket hang up error').finally(() => {
      iamMocks.done();
      cloudantMocks.done();
    });
  });

  it('iam_session returns error on renew', function() {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER_SHORT)
      .get(DBNAME)
      .reply(200, {doc_count: 0})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

    var cloudantClient = new Cloudant({ url: SERVER, maxAttempt: 1, plugins: { iamauth: { iamApiKey: IAM_API_KEY } } });
    return cloudantClient.db.get(DBNAME.substring(1)) /* Remove leading slash */
      .then(() => {
        // Wait for long enough for the background renewal to fail and the token to expire
        return new Promise(resolve => setTimeout(resolve, 2100));
      })
      .then(() => {
        return assert.rejects(
          cloudantClient.db.get(DBNAME.substring(1)),
          {
            error: 'unauthorized',
            reason: 'Unauthorized',
            statusCode: 401
          },
          'Should have rejected unauthorized after background renewal failure');
      })
      .finally(() => {
        iamMocks.done();
        cloudantMocks.done();
      });
  });

  it('retries access token post on error and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('returns an error if access token returns non-200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(3)
      .reply(500, 'Internal Error 500\nThe server encountered an unexpected condition which prevented it from fulfilling the request.');

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err.message, 'Failed to acquire access token. Status code: 500');
      iamMocks.done();
      done();
    });
  });

  it('retries IAM cookie login on error and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('returns an error if IAM cookie login returns non-200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(3)
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .times(3)
      .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err.message, 'Failed to exchange IAM token with Cloudant. Status code: 500');
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('renews authentication token on 401 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('throws error for unspecified IAM API key', function() {
    assert.throws(
      () => {
        /* eslint-disable no-new */
        new Client({ creds: { outUrl: SERVER }, plugins: 'iamauth' });
      },
      /Missing IAM API key from configuration/,
      'did not throw with expected message'
    );
  });

  it('supports using vcap with the promise plugin', function(done) {
    if (process.env.NOCK_OFF && !process.env.cloudant_iam_api_key) {
      this.skip();
    }

    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudant = new Cloudant({
      vcapServices: {
        cloudantNoSQLDB: [
          { credentials: { apikey: IAM_API_KEY, host: SERVER_NO_PROTOCOL } }
        ]
      },
      plugins: 'promises'
    });

    // Retrospectively modify the IAM token server URL to whatever is configured for the tests
    // since the VCAP blob always expects the production IAM token server
    const iamPlugin = cloudant.cc._plugins[cloudant.cc._pluginIds.indexOf('iamauth')];
    iamPlugin._tokenManager._iamTokenUrl = TOKEN_SERVER_URL;
    iamPlugin._cfg._iamTokenUrl = TOKEN_SERVER_URL;

    cloudant.use(DBNAME.substring(1)).info().then((data) => {
      assert.equal(data.doc_count, 0);
      iamMocks.done();
      cloudantMocks.done();
      done();
    }).catch(function(err) {
      assert.fail(`Unexpected reject: ${err}`);
    });
  });

  it('successfully retries request on 500 IAM token service response and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, maxAttempt: 3, plugins: { iamauth: { autoRenew: false, iamApiKey: IAM_API_KEY } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };

    var startTs = (new Date()).getTime();

    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
      assert.equal(resp.statusCode, 200);
      assert.ok(data.indexOf('"doc_count":0') > -1);

      // validate retry delay
      var now = (new Date()).getTime();
      assert.ok(now - startTs > (500 + 1000));

      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('supports changing the IAM API key', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': 'bad_key'
      })
      .times(3)
      .reply(400, {
        errorCode: 'BXNIM0415E',
        errorMessage: 'Provided API key could not be found'
      })
      .post('/identity/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_IAM_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ creds: { outUrl: SERVER }, plugins: { iamauth: { autoRenew: false, iamApiKey: 'bad_key' } } });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err.message, 'Failed to acquire access token. Status code: 400');

      // update IAM API key
      cloudantClient.getPlugin('iamauth').setIamApiKey(IAM_API_KEY);

      cloudantClient.request(req, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.request.headers.cookie, MOCK_IAM_SESSION);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":0') > -1);

        iamMocks.done();
        cloudantMocks.done();
        done();
      });
    });
  });
});
