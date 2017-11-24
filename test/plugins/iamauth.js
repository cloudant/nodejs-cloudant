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

/* global describe it before beforeEach after */
'use strict';

const assert = require('assert');
const Client = require('../../lib/client.js');
const nock = require('../nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const IAM_API_KEY = process.env.cloudant_iam_api_key || 'CqbrIYzdO3btWV-5t4teJLY_etfT_dkccq-vO-5vCXSo';
const SERVER = `https://${ME}.cloudant.com`;
const SERVER_WITH_CREDS = `https://${ME}:${PASSWORD}@${ME}.cloudant.com`;
const TOKEN_SERVER = 'https://iam.bluemix.net';
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

// mocks
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
const MOCK_OIDC_TOKEN_RESPONSE = {
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

describe('IAMAuth Plugin', function() {
  beforeEach(function() {
    if (process.env.SKIP_IAM_TESTS) {
      this.skip();
    }
  });

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

  it('performs request and returns 200 response', function(done) {
    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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
    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

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

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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

  it('performs request and returns 200 response when specifying credentials on request', function(done) {
    // NOTE: Use NOCK_OFF=true to test using a real CouchDB instance.
    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };

    cloudantClient.request(req, { iamApiKey: IAM_API_KEY }, function(err, resp, data) {
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

  it('performs request and returns 500 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err.code, 'ECONNRESET');
      assert.equal(err.message, 'socket hang up');
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('retries access token post on error and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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

  it('skips IAM authentication if access token returns non-200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(500, 'Internal Error 500\nThe server encountered an unexpected condition which prevented it from fulfilling the request.');

    var cloudantMocks = nock(SERVER)
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, null);
      assert.equal(resp.statusCode, 401);
      assert.ok(data.indexOf('"error":"unauthorized"') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('retries IAM cookie login on error and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .replyWithError({code: 'ECONNRESET', message: 'socket hang up'})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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

  it('skips IAM authentication if IAM cookie login returns non-200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(500, {error: 'internal_server_error', reason: 'Internal Server Error'})
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, null);
      assert.equal(resp.statusCode, 401);
      assert.ok(data.indexOf('"error":"unauthorized"') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('retries session post with new credentials and returns 200 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    const badApiKey = 'bAD%%Ap1@_KEy*123';

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': badApiKey
      })
      .reply(400, {
        errorCode: 'BXNIM0415E',
        errorMessage: 'Provided API key could not be found'
      })
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ iamApiKey: badApiKey, plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, null);
      assert.equal(resp.statusCode, 401);
      assert.ok(data.indexOf('"error":"unauthorized"') > -1);

      // specify a valid IAM API key on request
      cloudantClient.request(req, { iamApiKey: IAM_API_KEY }, function(err, resp, data) {
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

  it('renews authentication token on 401 response', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .times(2)
      .reply(200, MOCK_OIDC_TOKEN_RESPONSE);

    var cloudantMocks = nock(SERVER)
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'})
      .post('/_iam_session', {access_token: MOCK_ACCESS_TOKEN})
      .reply(200, {ok: true}, MOCK_SET_IAM_SESSION_HEADER)
      .get(DBNAME)
      .reply(200, {doc_count: 0});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
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

  it('skips authentication renewal on 401 response if previous attempts failed', function(done) {
    if (process.env.NOCK_OFF) {
      this.skip();
    }

    var iamMocks = nock(TOKEN_SERVER)
      .post('/oidc/token', {
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'response_type': 'cloud_iam',
        'apikey': IAM_API_KEY
      })
      .reply(400, {
        errorCode: 'BXNIM0415E',
        errorMessage: 'Provided API key could not be found'
      });

    var cloudantMocks = nock(SERVER)
      .get(DBNAME)
      .reply(401, {error: 'unauthorized', reason: 'Unauthorized'});

    var cloudantClient = new Client({ iamApiKey: IAM_API_KEY, plugin: 'iamauth' });
    var req = { url: SERVER + DBNAME, method: 'GET' };
    cloudantClient.request(req, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.request.headers.cookie, null);
      assert.equal(resp.statusCode, 401);
      assert.ok(data.indexOf('"error":"unauthorized"') > -1);
      iamMocks.done();
      cloudantMocks.done();
      done();
    });
  });

  it('throws error for unspecified IAM API key', function() {
    var cloudantClient = new Client({ plugin: 'iamauth' });
    assert.throws(
      () => {
        cloudantClient.request({ url: SERVER + DBNAME });
      },
      /Missing IAM API key from configuration/,
      'did not throw with expected message'
    );
  });
});
