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

/* global describe it before after */
'use strict';

const assert = require('assert');
const async = require('async');
const Cloudant = require('../cloudant.js');
const nock = require('./nock.js');
const uuidv4 = require('uuid/v4'); // random

const ME = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${ME}.cloudant.com`;
const DBNAME = `nodejs-cloudant-${uuidv4()}`;

describe('Partitioned Databases #db', () => {
  const partitionKeys = Array.apply(null, {length: 10})
    .map(() => { return uuidv4(); });

  before(() => {
    var mocks = nock(SERVER)
      .put(`/${DBNAME}`)
      .query({ partitioned: true })
      .reply(201, { ok: true });

    const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    return cloudant.db.create(DBNAME, { partitioned: true }).then((body) => {
      assert.ok(body.ok);
      mocks.done();
    });
  });

  after(() => {
    var mocks = nock(SERVER)
      .delete(`/${DBNAME}`)
      .reply(200, { ok: true });

    var cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    return cloudant.db.destroy(DBNAME).then((body) => {
      assert.ok(body.ok);
      mocks.done();
    });
  });

  it('created a partitioned database', () => {
    var mocks = nock(SERVER)
      .get(`/${DBNAME}`)
      .reply(200, { props: { partitioned: true } });

    const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    return cloudant.db.get(DBNAME).then((body) => {
      assert.ok(body.props.partitioned);
      mocks.done();
    });
  });

  it('create some partitioned documents', function(done) {
    if (!process.env.NOCK_OFF) {
      this.skip();
    }
    const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    const db = cloudant.db.use(DBNAME);

    var q = async.queue(function(task, callback) {
      db.bulk({ 'docs': task.docs }).then(callback).catch(done);
    }, 10);
    q.drain = done;

    for (let i in partitionKeys) {
      let docs = [];
      for (let j = 0; j < 10; j++) {
        docs.push({ _id: `${partitionKeys[i]}:doc${j}`, foo: 'bar' });
      }
      q.push({ 'docs': docs });
    }
  });

  it('get partition information', () => {
    const pKey = partitionKeys[0];

    var mocks = nock(SERVER)
      .get(`/${DBNAME}/_partition/${pKey}`)
      .reply(200, { partition: pKey, doc_count: 10 });

    const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    const db = cloudant.db.use(DBNAME);
    return db.partitionInfo(pKey).then((body) => {
      assert.equal(body.partition, pKey);
      assert.equal(body.doc_count, 10);
      mocks.done();
    });
  });

  it('get all documents in a partition', () => {
    const pKey = partitionKeys[0];

    var mocks = nock(SERVER)
      .get(`/${DBNAME}/_partition/${pKey}/_all_docs`)
      .reply(200, { rows: new Array(10) });

    const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
    const db = cloudant.db.use(DBNAME);
    return db.partitionedList(pKey).then((body) => {
      assert.equal(body.rows.length, 10);
      mocks.done();
    });
  });

  describe('Partitioned Query', () => {
    before(() => {
      if (!process.env.NOCK_OFF) {
        return;
      }
      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.createIndex({ index: { fields: ['foo'] } }).then((body) => {
        assert.equal(body.result, 'created');
      });
    });

    it('query a partitioned query', () => {
      const pKey = partitionKeys[0];
      const selector = { selector: { foo: { $eq: 'bar' } } };

      var mocks = nock(SERVER)
        .post(`/${DBNAME}/_partition/${pKey}/_find`, selector)
        .reply(200, { docs: new Array(10) });

      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.partitionedFind(pKey, selector).then((body) => {
        assert(body.docs.length, 10);
        mocks.done();
      });
    });
  });

  describe('Partitioned Search', () => {
    before(() => {
      if (!process.env.NOCK_OFF) {
        return;
      }
      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.insert({
        _id: '_design/mysearch',
        options: { partitioned: true },
        indexes: {
          search1: {
            index: 'function(doc) { index("id", doc._id, {"store": true}); }'
          }
        }
      }).then((body) => {
        assert.ok(body.ok);
      });
    });

    it('query a partitioned search', () => {
      const pKey = partitionKeys[0];

      var mocks = nock(SERVER)
        .post(`/${DBNAME}/_partition/${pKey}/_design/mysearch/_search/search1`,
          { q: '*:*' })
        .reply(200, { rows: new Array(10) });

      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.partitionedSearch(pKey, 'mysearch', 'search1', { q: '*:*' }).then((body) => {
        assert(body.rows.length, 10);
        mocks.done();
      });
    });
  });

  describe('Partitioned View', () => {
    before(() => {
      if (!process.env.NOCK_OFF) {
        return;
      }
      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.insert({
        _id: '_design/myview',
        options: { partitioned: true },
        views: { view1: { map: 'function(doc) { emit(doc._id, 1); }' } }
      }).then((body) => {
        assert.ok(body.ok);
      });
    });

    it('query a partitioned view', () => {
      const pKey = partitionKeys[0];

      var mocks = nock(SERVER)
        .get(`/${DBNAME}/_partition/${pKey}/_design/myview/_view/view1`)
        .reply(200, { rows: new Array(10) });

      const cloudant = Cloudant({ url: SERVER, username: ME, password: PASSWORD, plugins: [] });
      const db = cloudant.db.use(DBNAME);
      return db.partitionedView(pKey, 'myview', 'view1').then((body) => {
        assert(body.rows.length, 10);
        mocks.done();
      });
    });
  });
});
