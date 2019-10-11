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
'use strict';

const async = require('async');
const Cloudant = require('../cloudant.js');
const debug = require('debug')('test:soak');
const fs = require('fs');
const tmp = require('tmp');
const uuidv4 = require('uuid/v4'); // random

const USER = process.env.cloudant_username || 'nodejs';
const PASSWORD = process.env.cloudant_password || 'sjedon';
const SERVER = process.env.SERVER_URL || `https://${USER}:${PASSWORD}@${USER}.cloudant.com`;

const MAX_RUNS = parseInt(process.env.max_runs, 10) || 100;
const CONCURRENCY = parseInt(process.env.concurrency, 10) || 1;

debug.enabled = true; // enable debugging

var c1 = new Cloudant({
  url: SERVER,
  plugins: [ 'cookieauth', 'promises', 'retry' ]
});

var c2 = new Cloudant({
  url: SERVER,
  plugins: [ 'cookieauth', 'retry' ] // without 'promises' plugin
});

var assert = function(actual, expected, done) {
  if (actual !== expected) {
    done(new Error(`${actual} is not equal to ${expected}`));
  }
};

var runTests = function(done) {
  const DBNAME = `nodejs-cloudant-${uuidv4()}`;
  const DOCID = `my-doc-${uuidv4()}`;

  debug(`[TEST RUN] Using database '${DBNAME}'.`);

  c1
    // HEAD /
    .ping()

    .then((d) => {
      assert(d.statusCode, 200, done);

      // PUT /<db>
      return c1.db.create(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 201, done);

      // GET /<db>
      return c1.db.get(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d.doc_count, 0, done);

      let db = c1.db.use(DBNAME);
      // GET /<db>/_security
      return db.get_security();
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(Object.keys(d).length, 1, done);

      let db = c1.use(DBNAME);
      // POST /<db>/<docid>
      return db.insert({ foo: 'bar' }, DOCID);
    })

    .then((d) => {
      assert(d.statusCode, 201, done);
      assert(d.id, DOCID, done);

      // GET /<db>
      return c1.db.get(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d.doc_count, 1, done);

      let db = c1.db.use(DBNAME);
      // GET /<db>/<docid>
      return db.get(DOCID);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d._id, DOCID, done);

      let db = c1.db.use(DBNAME);
      // DELETE /<db>/<docid>
      return db.destroy(d._id, d._rev);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d.id, DOCID, done);

      // POST /<db>/_bulk_docs
      return c1.request({
        path: DBNAME + '/_bulk_docs',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fs.readFileSync('bulk_docs.json')
      });
    })

    .then((d) => {
      assert(d.statusCode, 201, done);

      // GET /<db>
      return c1.db.get(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d.doc_count, 5096, done);

      return new Promise((resolve, reject) => {
        async.waterfall([
          (cb) => {
            let fName = tmp.fileSync().name;
            // GET /<db>/_changes
            c2.request({ path: DBNAME + '/_changes' })
              .on('error', (e) => { done(e); })
              .pipe(fs.createWriteStream(fName))
              .on('finish', () => {
                let results = JSON.parse(fs.readFileSync(fName)).results;
                assert(results.length, 5097, done);
                cb(null, results);
              });
          },
          (results, cb) => {
            let db = c2.db.use(DBNAME);
            let docIds = [];
            results.slice(0, 1234).forEach((result) => {
              docIds.push(result.id);
            });
            async.eachLimit(docIds, 10, (docId, cb) => {
              // GET /<db>/<docid>
              db.get(docId)
                .on('error', (e) => { done(e); })
                .on('response', (r) => {
                  if (docId.startsWith('my-doc-')) {
                    assert(r.statusCode, 404, done); // doc was deleted
                  } else {
                    assert(r.statusCode, 200, done);
                  }
                })
                .on('end', cb);
            }, cb);
          },
          (cb) => {
            fs.createReadStream('animaldb_bulk_docs.json').pipe(
              // POST /<db>/_bulk_docs
              c2.cc.request({
                url: SERVER + '/' + DBNAME + '/_bulk_docs',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              })
                .on('error', (e) => { done(e); })
                .on('response', (r) => {
                  assert(r.statusCode, 201, done);
                })
                .on('end', cb)
            );
          },
          (cb) => {
            let db = c2.db.use(DBNAME);
            let docIds = [];
            for (var i = 0; i < 1234; i++) {
              docIds.push(`my-new-doc-${i}`);
            }
            async.eachLimit(docIds, 10, (docId, cb) => {
              // POST /<db>/<docid>
              db.insert(fs.readFileSync('doc.json'), docId, (e, b) => {
                assert(b.ok, true, done);
                cb();
              });
            }, (e) => { cb(e); });
          }
        ],
        (e) => {
          if (e) {
            reject(e);
          } else {
            resolve();
          }
        });
      });
    })

    .then((d) => {
      // GET /<db>
      return c1.db.get(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      assert(d.doc_count, 6341, done);

      // DELETE /<db>
      return c1.db.destroy(DBNAME);
    })

    .then((d) => {
      assert(d.statusCode, 200, done);
      done();
    })

    .catch((e) => { done(e); });
};

var tests = [];
for (var i = 0; i < MAX_RUNS; i++) {
  tests.push(runTests);
}

debug('Starting test...');

async.parallelLimit(tests, CONCURRENCY, function(e) {
  if (e) {
    debug(e);
    process.exit(1);
  } else {
    debug('All tests passed successfully.');
  }
});
