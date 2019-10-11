// Copyright © 2018 IBM Corp. All rights reserved.
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
const Client = require('../lib/client.js');
const fs = require('fs');
const md5File = require('md5-file');
const nock = require('./nock.js');
const stream = require('stream');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const DBNAME = `/nodejs-cloudant-${uuidv4()}`;

describe('#db Stream', function() {
  before(function(done) {
    var mocks = nock(SERVER)
      .put(DBNAME)
      .reply(201, {ok: true});

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'PUT'
    };
    cloudantClient.request(options, function(err, resp) {
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

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME,
      auth: { username: ME, password: PASSWORD },
      method: 'DELETE'
    };
    cloudantClient.request(options, function(err, resp) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
      mocks.done();
      done();
    });
  });

  it('bulk documents to database', function(done) {
    var mocks = nock(SERVER)
      .post(DBNAME + '/_bulk_docs')
      .reply(201, { ok: true })
      .get(DBNAME)
      .reply(200, { doc_count: 5096 });

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME + '/_bulk_docs',
      auth: { username: ME, password: PASSWORD },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    var req = cloudantClient.request(options, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 201);

      var options = {
        url: SERVER + DBNAME,
        auth: { username: ME, password: PASSWORD },
        method: 'GET'
      };
      cloudantClient.request(options, function(err, resp, data) {
        assert.equal(err, null);
        assert.equal(resp.statusCode, 200);
        assert.ok(data.indexOf('"doc_count":5096') > -1);

        mocks.done();
        done();
      });
    });

    fs.createReadStream('test/fixtures/bulk_docs.json')
      .pipe(new stream.PassThrough({ highWaterMark: 1000 })).pipe(req);
  });

  it('all documents to file', function(done) {
    var mocks = nock(SERVER)
      .get(DBNAME + '/_all_docs')
      .query({ include_docs: true })
      .reply(200, fs.readFileSync('test/fixtures/all_docs_include_docs.json'));

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME + '/_all_docs',
      qs: { include_docs: true },
      auth: { username: ME, password: PASSWORD },
      method: 'GET'
    };
    var req = cloudantClient.request(options, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
    });

    var results = fs.createWriteStream('data.json');
    req.pipe(new stream.PassThrough({ highWaterMark: 1000 })).pipe(results)
      .on('finish', function() {
        assert.equal(md5File.sync('data.json'), md5File.sync('test/fixtures/all_docs_include_docs.json'));
        fs.unlinkSync('data.json');
        mocks.done();
        done();
      });
  });

  it('all documents to file (when piping inside response handler)', function(done) {
    var mocks = nock(SERVER)
      .get(DBNAME + '/_all_docs')
      .query({ include_docs: true })
      .reply(200, fs.readFileSync('test/fixtures/all_docs_include_docs.json'));

    var cloudantClient = new Client({ plugins: 'retry' });

    var options = {
      url: SERVER + DBNAME + '/_all_docs',
      qs: { include_docs: true },
      auth: { username: ME, password: PASSWORD },
      method: 'GET'
    };
    var req = cloudantClient.request(options, function(err, resp, data) {
      assert.equal(err, null);
      assert.equal(resp.statusCode, 200);
    })
      .on('response', function(resp) {
        if (resp.statusCode !== 200) {
          assert.fail(`Failed to GET /_all_docs. Status code: ${resp.statusCode}`);
        } else {
          req
            .pipe(new stream.PassThrough({ highWaterMark: 1000 }))
            .pipe(fs.createWriteStream('data.json'))
            .on('finish', function() {
              assert.equal(md5File.sync('data.json'), md5File.sync('test/fixtures/all_docs_include_docs.json'));
              fs.unlinkSync('data.json');
              mocks.done();
              done();
            });
        }
      });
  });
});
