// Copyright © 2015, 2017 IBM Corp. All rights reserved.
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

if (!process.env.CLOUDANT_URL) {
  console.error("Please put the URL of your Cloudant instance in an environment variable 'CLOUDANT_URL'");
  process.exit(1);
}

// load the Cloudant library
var async = require('async');
var Cloudant = require('@cloudant/cloudant');
var cloudant = Cloudant({url: process.env.CLOUDANT_URL});
var dbname = 'crud';
var db = null;
var doc = null;

// create a database
var createDatabase = function(callback) {
  console.log("Creating database '" + dbname + "'");
  cloudant.db.create(dbname, function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    db = cloudant.db.use(dbname);
    callback(err, data);
  });
};

// create a document
var createDocument = function(callback) {
  console.log("Creating document 'mydoc'");
  // we are specifying the id of the document so we can update and delete it later
  db.insert({ _id: 'mydoc', a: 1, b: 'two' }, function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    callback(err, data);
  });
};

// read a document
var readDocument = function(callback) {
  console.log("Reading document 'mydoc'");
  db.get('mydoc', function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    // keep a copy of the doc so we know its revision token
    doc = data;
    callback(err, data);
  });
};

// update a document
var updateDocument = function(callback) {
  console.log("Updating document 'mydoc'");
  // make a change to the document, using the copy we kept from reading it back
  doc.c = true;
  db.insert(doc, function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    // keep the revision of the update so we can delete it
    doc._rev = data.rev;
    callback(err, data);
  });
};

// deleting a document
var deleteDocument = function(callback) {
  console.log("Deleting document 'mydoc'");
  // supply the id and revision to be deleted
  db.destroy(doc._id, doc._rev, function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    callback(err, data);
  });
};

// deleting the database document
var deleteDatabase = function(callback) {
  console.log("Deleting database '" + dbname + "'");
  cloudant.db.destroy(dbname, function(err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    callback(err, data);
  });
};

async.series([createDatabase, createDocument, readDocument, updateDocument, deleteDocument, deleteDatabase]);
