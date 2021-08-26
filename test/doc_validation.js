// Copyright © 2021 IBM Corp. All rights reserved.
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

/* global describe it before */
'use strict';

const assert = require('assert');
const Cloudant = require('../cloudant.js');
const nock = require('./nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = 'nodejs';
const PASSWORD = 'sjedon';
const SERVER = `https://${ME}.cloudant.com`;
const DBNAME = `nodejs-cloudant-${uuidv4()}`;
const db = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] }).use(DBNAME);

// Encode '/' path separator if it exists within the document ID
// or attachment name e.g. _design//foo will result in _design/%2Ffoo
function encodePathSeparator(docName) {
  if (docName.includes('/')) {
    return docName.replace(/\//g, encodeURIComponent('/'));
  }
  return docName;
}

describe('validation', function() {
  before(function() {
    if (process.env.NOCK_OFF) {
      this.skip();
    }
  });

  describe('document and attachment validation', function() {
    // GET _all_docs
    // EXPECTED: validation failure
    it('get invalid _all_docs document', function(done) {
      db.get('_all_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _all_docs');
        done();
      });
    });
    // HEAD _all_docs
    // EXPECTED: validation failure
    it('head invalid _all_docs document', function(done) {
      db.head('_all_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _all_docs');
        done();
      });
    });
    // GET _design/foo
    // EXPECTED: 200
    it('get valid design document', function(done) {
      var docId = '_design/foo';
      var docRev = '1-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/foo`)
        .reply(200, {'_id': docId, '_rev': docRev});

      db.get('_design/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        assert.strictEqual(result._id, docId);
        assert.strictEqual(result._rev, docRev);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo
    // EXPECTED: 200
    it('head valid design document', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/foo`)
        .reply(200);

      db.head('_design/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        mocks.done();
        done();
      });
    });
    // GET /_design/foo with leading slash
    // EXPECTED: 404
    it('get valid design document', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/` + encodePathSeparator('/_design/foo'))
        .reply(404);

      db.get('/_design/foo', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD /_design/foo with leading slash
    // EXPECTED: 404
    it('head valid design document', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/` + encodePathSeparator('/_design/foo'))
        .reply(404);

      db.head('/_design/foo', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design
    // EXPECTED: Validation exception
    it('get invalid _design', function(done) {
      db.get('_design', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // HEAD _design
    // EXPECTED: Validation exception
    it('head invalid _design', function(done) {
      db.head('_design', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // GET /_design/ddoc_view with a slash
    // EXPECTED: 404
    it('get missing view /_design/ddoc_view', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/` + encodePathSeparator('/_design/ddoc_view'))
        .reply(404);
      db.get('/_design/ddoc_view', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD /_design/ddoc_view with a slash
    // EXPECTED: 404
    it('head missing view /_design/ddoc_view', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/` + encodePathSeparator('/_design/ddoc_view'))
        .reply(404);
      db.head('/_design/ddoc_view', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_view/bar
    // EXPECTED: 404
    it('get missing view', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_view/bar'))
        .reply(404);

      db.get('_design/foo/_view/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_view/bar
    // EXPECTED: 404
    it('head missing view', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_view/bar'))
        .reply(404);

      db.head('_design/foo/_view/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_info
    // EXPECTED: 404
    it('get missing view _info', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_info'))
        .reply(404);

      db.get('_design/foo/_info', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_info
    // EXPECTED: 404
    it('head missing view _info', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_info'))
        .reply(404);

      db.head('_design/foo/_info', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_search/bar
    // EXPECTED: 404
    it('get missing search', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search/bar'))
        .reply(404);

      db.get('_design/foo/_search/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_search/bar
    // EXPECTED: 404
    it('head missing search', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search/bar'))
        .reply(404);

      db.head('_design/foo/_search/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_search_info/bar
    // EXPECTED: 404
    it('get missing _search_info', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search_info/bar'))
        .reply(404);

      db.get('_design/foo/_search_info/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_search_info/bar
    // EXPECTED: 404
    it('head missing _search_info', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search_info/bar'))
        .reply(404);

      db.head('_design/foo/_search_info/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_geo/bar
    // EXPECTED: 404
    it('get missing _geo', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodeURIComponent('foo/_geo/bar'))
        .reply(404)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo/bar?bbox=-50.52,-4.46,54.59,1.45'))
        .reply(404);

      db.get('_design/foo/_geo/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
      });
      // Test with parameter
      db.get('_design/foo/_geo/bar?bbox=-50.52,-4.46,54.59,1.45', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_geo/bar
    // EXPECTED: 404
    it('head missing _geo', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo/bar'))
        .reply(404)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo/bar?bbox=-50.52,-4.46,54.59,1.45'))
        .reply(404);

      db.head('_design/foo/_geo/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
      });
      // Test with parameter
      db.head('_design/foo/_geo/bar?bbox=-50.52,-4.46,54.59,1.45', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_geo_info/bar
    // EXPECTED: 404
    it('get missing _geo_info', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo_info/bar'))
        .reply(404);

      db.get('_design/foo/_geo_info/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // HEAD _design/foo/_geo_info/bar
    // EXPECTED: 404
    it('head missing _geo_info', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo_info/bar'))
        .reply(404);

      db.head('_design/foo/_geo_info/bar', function(err, result, header) {
        assert.strictEqual(err.headers.statusCode, 404);
        assert.strictEqual(result, undefined);
        mocks.done();
        done();
      });
    });
    // GET _local/foo
    // EXPECTED: 200
    it('get valid _local document', function(done) {
      var docId = '_local/foo';
      var docRev = '1-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_local/foo`)
        .reply(200, {'_id': docId, '_rev': docRev});

      db.get('_local/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        assert.strictEqual(result._id, docId);
        assert.strictEqual(result._rev, docRev);
        mocks.done();
        done();
      });
    });
    // HEAD _local/foo
    // EXPECTED: 200
    it('head valid _local document', function(done) {
      var mocks = nock(SERVER)
        .head(`/${DBNAME}/_local/foo`)
        .reply(200);

      db.head('_local/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        mocks.done();
        done();
      });
    });
    // GET _local
    // EXPECTED: Validation exception
    it('get invalid _local', function(done) {
      db.get('_local', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local');
        done();
      });
    });
    // HEAD _local
    // EXPECTED: Validation exception
    it('head invalid _local', function(done) {
      db.get('_local', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local');
        done();
      });
    });
    // GET _local_docs
    // EXPECTED: Validation exception
    it('get invalid _local_docs document', function(done) {
      db.get('_local_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local_docs');
        done();
      });
    });
    // HEAD _local_docs
    // EXPECTED: Validation exception
    it('head invalid _local_docs document', function(done) {
      db.head('_local_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local_docs');
        done();
      });
    });
    // GET _design_docs
    // EXPECTED: Validation exception
    it('get invalid _design_docs document', function(done) {
      db.get('_design_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design_docs');
        done();
      });
    });
    // HEAD _design_docs
    // EXPECTED: Validation exception
    it('head invalid _design_docs document', function(done) {
      db.head('_design_docs', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design_docs');
        done();
      });
    });
    // GET _changes
    // EXPECTED: Validation exception
    it('get invalid _changes document', function(done) {
      db.get('_changes', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _changes');
        done();
      });
    });
    // HEAD _changes
    // EXPECTED: Validation exception
    it('head invalid _changes document', function(done) {
      db.head('_changes', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _changes');
        done();
      });
    });
    // GET _ensure_full_commit
    // EXPECTED: Validation exception
    it('get invalid _ensure_full_commit document', function(done) {
      db.get('_ensure_full_commit', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _ensure_full_commit');
        done();
      });
    });
    // HEAD _ensure_full_commit
    // EXPECTED: Validation exception
    it('head invalid _ensure_full_commit document', function(done) {
      db.head('_ensure_full_commit', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _ensure_full_commit');
        done();
      });
    });
    // GET _index
    // EXPECTED: Validation exception
    it('get invalid _index document', function(done) {
      db.get('_index', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index');
        done();
      });
    });
    // HEAD _index
    // EXPECTED: Validation exception
    it('head invalid _index document', function(done) {
      db.head('_index', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index');
        done();
      });
    });
    // GET _revs_limit
    // EXPECTED: Validation exception
    it('get invalid _revs_limit document', function(done) {
      db.get('_revs_limit', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _revs_limit');
        done();
      });
    });
    // HEAD _revs_limit
    // EXPECTED: Validation exception
    it('head invalid _revs_limit document', function(done) {
      db.head('_revs_limit', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _revs_limit');
        done();
      });
    });
    // GET _security
    // EXPECTED: Validation exception
    it('get invalid _security document', function(done) {
      db.get('_security', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _security');
        done();
      });
    });
    // HEAD _security
    // EXPECTED: Validation exception
    it('head invalid _security document', function(done) {
      db.head('_security', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _security');
        done();
      });
    });
    // GET _shards
    // EXPECTED: Validation exception
    it('get invalid _shards document', function(done) {
      db.get('_shards', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _shards');
        done();
      });
    });
    // HEAD _shards
    // EXPECTED: Validation exception
    it('head invalid _shards document', function(done) {
      db.head('_shards', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _shards');
        done();
      });
    });
    // DELETE _index/_design/foo/json/bar
    // EXPECTED: Validation exception
    it('delete invalid _index/_design/foo/json/bar document', function(done) {
      db.attachment.destroy('_index/_design', 'foo/json/bar', function(err, result) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index/_design');
        done();
      });
    });
    // DELETE _design/foo
    // EXPECTED: 200
    it('delete valid design document', function(done) {
      var docId = '_design/foo';
      var docRev = '2-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .delete(`/${DBNAME}/_design/foo`)
        .reply(200, {'_id': docId, '_rev': docRev});

      db.destroy('_design/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        assert.strictEqual(result._id, docId);
        assert.strictEqual(result._rev, docRev);
        mocks.done();
        done();
      });
    });
    // DELETE _design
    // EXPECTED: Validation exception
    it('delete invalid _design', function(done) {
      db.destroy('_design', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // DELETE _local/foo
    // EXPECTED: 200
    it('delete valid _local document', function(done) {
      var docId = '_local/foo';
      var docRev = '2-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .delete(`/${DBNAME}/_local/foo`)
        .reply(200, {'_id': docId, '_rev': docRev});

      db.destroy('_local/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        assert.strictEqual(result._id, docId);
        assert.strictEqual(result._rev, docRev);
        mocks.done();
        done();
      });
    });
    // DELETE _local
    // EXPECTED: Validation exception
    it('delete invalid _local', function(done) {
      db.destroy('_local', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local');
        done();
      });
    });
    // PUT _design/foo
    // NOTE: only PUT request if opts.docName exists
    // EXPECTED: 201
    it('put valid design document', function(done) {
      var docId = '_design/foo';
      var docRev = '1-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .put(`/${DBNAME}/_design/foo`)
        .reply(201, {ok: true, id: docId, rev: docRev});
      // doc name must be in opts to use PUT request
      db.insert('', '_design/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 201);
        assert.strictEqual(result.id, docId);
        assert.strictEqual(result.rev, docRev);
        mocks.done();
        done();
      });
    });
    // PUT _design
    // NOTE: only PUT request if opts.docName exists
    // EXPECTED: Validation exception
    it('put invalid _design', function(done) {
      // doc name must be in opts to use PUT request
      db.insert('', '_design', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // PUT _local/foo
    // EXPECTED: 201
    it('put valid local document', function(done) {
      var docId = '_local/foo';
      var docRev = '1-967a00dff5e02add41819138abb3284d';
      var mocks = nock(SERVER)
        .put(`/${DBNAME}/_local/foo`)
        .reply(201, {ok: true, id: docId, rev: docRev});
      // doc name must be in opts to use PUT request
      db.insert('', '_local/foo', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 201);
        assert.strictEqual(result.id, docId);
        assert.strictEqual(result.rev, docRev);
        mocks.done();
        done();
      });
    });
    // PUT _local
    // NOTE: only PUT request if opts.docName exists
    // EXPECTED: Validation exception
    it('put invalid _local', function(done) {
      // doc name must be in opts to use PUT request
      db.insert('', '_local', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _local');
        done();
      });
    });
    // PUT _revs_limit
    // NOTE: only PUT request if opts.docName exists
    // EXPECTED: Validation exception
    it('put invalid _revs_limit', function(done) {
      // doc name must be in opts to use PUT request
      db.insert('', '_revs_limit', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _revs_limit');
        done();
      });
    });
    // PUT _security
    // NOTE: only PUT request if opts.docName exists
    // EXPECTED: Validation exception
    it('put invalid _security', function(done) {
      // doc name must be in opts to use PUT request
      db.insert('', '_security', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _security');
        done();
      });
    });
    // GET _design/foo/bar
    // EXPECTED: 200
    it('get valid design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/foo/bar`)
        .reply(200);

      db.attachment.get('_design/foo', 'bar', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        mocks.done();
        done();
      });
    });
    // PUT _design/foo/bar
    // EXPECTED: 201
    it('insert valid design document attachment', function(done) {
      var mocks = nock(SERVER)
        .put(`/${DBNAME}/_design/foo/bar`)
        .reply(201);

      db.attachment.insert('_design/foo', 'bar', 'test message', 'text/plain', function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 201);
        mocks.done();
        done();
      });
    });

    // DELETE _design/foo/bar
    // EXPECTED: 200
    it('delete valid design document attachment', function(done) {
      var mocks = nock(SERVER)
        .delete(`/${DBNAME}/_design/foo/bar?rev=1-234`)
        .reply(200);

      db.attachment.destroy('_design/foo', 'bar', {rev: '1-234'}, function(err, result, header) {
        assert.strictEqual(err, null);
        assert.strictEqual(header.statusCode, 200);
        mocks.done();
        done();
      });
    });
    // GET _design/foo
    // EXPECTED: Validaton exception
    it('get invalid design doc attachment', function(done) {
      db.attachment.get('_design', 'foo', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // PUT _design/foo
    // EXPECTED: Validaton exception
    it('put invalid design doc attachment', function(done) {
      db.attachment.insert('_design', 'foo', 'test message', 'text/plain', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // DELETE _design/foo
    // EXPECTED: Validaton exception
    it('delete invalid design doc attachment', function(done) {
      db.attachment.destroy('_design', 'foo', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // DELETE _index + _design/foo/json/bar
    // EXPECTED: Validation exception
    it('delete _index + _design/foo/json/bar index via attachment', function(done) {
      db.attachment.destroy('_index', '_design/foo/json/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index');
        done();
      });
    });
    // DELETE _index/_design + foo/json/bar
    // EXPECTED: Validation exception
    it('delete _index + _design/foo/json/bar index via attachment', function(done) {
      db.attachment.destroy('_index/_design', 'foo/json/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index/_design');
        done();
      });
    });
    // DELETE _index/_design/foo + json/bar
    // EXPECTED: Validation exception
    it('delete _index/_design/foo + json/bar index via attachment', function(done) {
      db.attachment.destroy('_index/_design/foo', 'json/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index/_design/foo');
        done();
      });
    });
    // DELETE _index/_design/foo + json/bar
    // EXPECTED: Validation exception
    it('delete _index/_design/foo/json + bar index via attachment', function(done) {
      db.attachment.destroy('_index/_design/foo/json', 'bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _index/_design/foo/json');
        done();
      });
    });
    // GET _design/foo/_view + /bar
    // EXPECTED: 404
    it('get _design/foo/_view + /bar view via design attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_view') + `/bar`)
        .reply(404);

      db.attachment.get('_design/foo/_view', 'bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + /%2F_view%2Fbar
    // EXPECTED: 404
    it('get _design/foo + /%2F_view%2Fbar view via design attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/foo/` + encodePathSeparator('/_view/bar'))
        .reply(404);

      db.attachment.get('_design/foo', '/_view/bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + /_view%2Fbar
    // EXPECTED: Validation exception
    it('get _design/foo + /_view%2Fbar view via design attachment', function(done) {
      db.attachment.get('_design/foo', '_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _view/bar');
        done();
      });
    });
    // GET _design + foo/_view/bar
    // EXPECTED: Validation exception
    it('get _design + foo/_view/bar view via design attachment', function(done) {
      db.attachment.get('_design', 'foo/_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // GET _design/ + foo/_view/bar
    // EXPECTED: Validation exception
    it('get _design/ + foo/_view/bar view via design attachment', function(done) {
      db.attachment.get('_design/', 'foo/_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design/');
        done();
      });
    });
    // PUT _design/foo + _view/bar
    // EXPECTED: Validation exception
    it('put invalid _design/foo + _view/bar via design attachment', function(done) {
      db.attachment.insert('_design/foo', '_view/bar', 'test message', 'text/plain', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _view/bar');
        done();
      });
    });
    // PUT _design + foo/_view/bar
    // EXPECTED: Validation exception
    it('put invalid _design + foo/_view/bar via design attachment', function(done) {
      db.attachment.insert('_design', 'foo/_view/bar', 'test message', 'text/plain', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // PUT _design/ + foo/_view/bar
    // EXPECTED: Validation exception
    it('put invalid _design/ + foo/_view/bar via design attachment', function(done) {
      db.attachment.insert('_design/', 'foo/_view/bar', 'test message', 'text/plain', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design/');
        done();
      });
    });
    // DELETE _design/foo + _view/bar
    // EXPECTED: Validation exception
    it('delete invalid _design/foo + _view/bar via design attachment', function(done) {
      db.attachment.destroy('_design/foo', '_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _view/bar');
        done();
      });
    });
    // DELETE _design + foo/_view/bar
    // EXPECTED: Validation exception
    it('delete invalid _design + foo/_view/bar via design attachment', function(done) {
      db.attachment.destroy('_design', 'foo/_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // DELETE _design/ + foo/_view/bar
    // EXPECTED: Validation exception
    it('delete invalid _design/ + foo/_view/bar via design attachment', function(done) {
      db.attachment.destroy('_design/', 'foo/_view/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design/');
        done();
      });
    });
    // GET _design/foo + _info
    // EXPECTED: Validation exception
    it('get invalid _design/foo + _info via design document attachment', function(done) {
      db.attachment.get('_design/foo', '_info', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _info');
        done();
      });
    });
    // GET _design + foo/_info
    // EXPECTED: Validation exception
    it('get invalid _design + foo/_info via design document attachment', function(done) {
      db.attachment.get('_design', 'foo/_info', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // GET _design/ + foo/_info
    // EXPECTED: Validation exception
    it('get invalid _design/ + foo/_info via design document attachment', function(done) {
      db.attachment.get('_design/', 'foo/_info', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design/');
        done();
      });
    });
    // GET _design/foo/_search + bar
    // EXPECTED: 404
    it('get _design/foo/_search + bar search via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search') + `/bar`)
        .reply(404);

      db.attachment.get('_design/foo/_search', 'bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_search + bar?q=*.*
    // EXPECTED: 404
    it('get _design/foo/_search + bar?q=*.* search via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search') + `/bar?q=*.*`)
        .reply(404);

      db.attachment.get('_design/foo/_search', 'bar?q=*.*', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + _search/bar
    // EXPECTED: Validation exception
    it('get _design/foo + _search/bar search via design document attachment', function(done) {
      db.attachment.get('_design/foo', '_search/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _search/bar');
        done();
      });
    });
    // GET _design + foo/_search/bar
    // EXPECTED: Validation exception
    it('get _design + foo/_search/bar search via design document attachment', function(done) {
      db.attachment.get('_design', 'foo/_search/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design');
        done();
      });
    });
    // GET _design/ + foo/_search/bar
    // EXPECTED: Validation exception
    it('get _design + foo/_search/bar search via design document attachment', function(done) {
      db.attachment.get('_design/', 'foo/_search/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _design/');
        done();
      });
    });
    // GET _design/foo/_search_info + bar
    // EXPECTED: 404
    it('get design/foo/_search_info + bar search info via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_search_info') + `/bar`)
        .reply(404);

      db.attachment.get('_design/foo/_search_info', 'bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + _search_info/bar
    // EXPECTED: Validation exception
    it('get design/foo + _search_info/bar search info via design document attachment', function(done) {
      db.attachment.get('_design/foo', '_search_info/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _search_info/bar');
        done();
      });
    });
    // GET _design/foo/_geo + bar
    // EXPECTED: 404
    it('get _design/foo/_geo + bar _geo via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo') + `/bar`)
        .reply(404);

      db.attachment.get('_design/foo/_geo', 'bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo/_geo + bar?bbox
    it('get _design/foo/_geo + bar?bbox _geo via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo') + `/bar?bbox=-50.52,-4.46,54.59,1.45`)
        .reply(404);

      db.attachment.get('_design/foo/_geo', 'bar?bbox=-50.52,-4.46,54.59,1.45', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + _geo/bar
    // EXPECTED: Validation exception
    it('get _design/foo + _geo/bar _geo via design document attachment', function(done) {
      db.attachment.get('_design/foo', '_geo/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _geo/bar');
        done();
      });
    });
    // GET _design/foo/_geo_info + bar
    // EXPECTED: 404
    it('get _design/foo/_geo_info + bar _geo_info via design document attachment', function(done) {
      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_design/` + encodePathSeparator('foo/_geo_info') + `/bar`)
        .reply(404);

      db.attachment.get('_design/foo/_geo_info', 'bar', function(err, result, header) {
        assert.strictEqual(result, undefined);
        assert.strictEqual(err.headers.statusCode, 404);
        mocks.done();
        done();
      });
    });
    // GET _design/foo + _geo_info/bar
    // EXPECTED: Validation exception
    it('get _design/foo + _geo_info/bar _geo_info via design document attachment', function(done) {
      db.attachment.get('_design/foo', '_geo_info/bar', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid attachment name: _geo_info/bar');
        done();
      });
    });
    // GET _partition/foo
    // EXPECTED: Validation exception
    it('get invalid _partition document', function(done) {
      db.get('_partition/foo', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition/foo');
        done();
      });
    });
    // HEAD _partition/foo
    // EXPECTED: Validation exception
    it('head invalid _partition document', function(done) {
      db.head('_partition/foo', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition/foo');
        done();
      });
    });
    // GET _partition/foo
    // EXPECTED: Validation exception
    it('get invalid _partition via attachment', function(done) {
      db.attachment.get('_partition', 'foo', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition');
        done();
      });
    });
    // GET _partition/foo/_all_docs
    // EXPECTED: Validation exception
    it('get invalid _partition/foo/_all_docs document', function(done) {
      db.get('_partition/foo/_all_docs', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition/foo/_all_docs');
        done();
      });
    });
    // HEAD _partition/foo/_all_docs
    // EXPECTED: Validation exception
    it('head invalid _partition/foo/_all_docs document', function(done) {
      db.head('_partition/foo/_all_docs', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition/foo/_all_docs');
        done();
      });
    });
    // GET _partition + foo/_all_docs
    // EXPECTED: Validation exception
    it('get invalid _partition + foo/_all_docs via attachment', function(done) {
      db.attachment.get('_partition', 'foo/_all_docs', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition');
        done();
      });
    });
    // GET _partition/foo + _all_docs
    // EXPECTED: Validation exception
    it('get invalid _partition/foo + _all_docs via attachment', function(done) {
      db.attachment.get('_partition/foo', '_all_docs', function(err, result, header) {
        assert.strictEqual(result, null);
        assert.strictEqual(err.toString(), 'Error: Invalid document ID: _partition/foo');
        done();
      });
    });
  });
});
