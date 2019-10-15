// Copyright © 2017, 2018 IBM Corp. All rights reserved.
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
const debug = require('debug')('cloudant:clientutils');

// send response to the client
var sendResponseToClient = function(response, clientStream, clientCallback) {
  debug('An alternative response will be returned to the client');
  // response = [<error>, <response>, <data>]
  if (response[0]) {
    clientStream.emit('error', response[0]);
  }
  if (response[1]) {
    clientStream.emit('response', response[1]);
  }
  if (response[2]) {
    clientStream.emit('data', Buffer.from(response[2], 'utf8'));
  }
  clientStream.emit('end');

  if (typeof clientCallback === 'function') {
    clientCallback.apply(null, response); // execute client callback
  }
};

// update the state with a new state (from plugin hook)
var updateState = function(state, newState, callback) {
  if (newState.abortWithResponse) {
    // plugin requested immediate abort
    state.retry = false;
    state.abortWithResponse = newState.abortWithResponse;
    return callback(new Error('Plugin issued abort')); // stop plugin hooks
  }
  if (newState.retry) {
    state.retry = true; // plugin requested a retry
  }
  if (newState.retryDelayMsecs > state.retryDelayMsecs) {
    state.retryDelayMsecs = newState.retryDelayMsecs; // set new retry delay
  }
  callback();
};

// public

// process state (following plugin execution)
var processState = function(r, callback) {
  var abort = function() {
    if (r.response) {
      debug('Client issued abort.');
      r.response.abort();
    }
  };

  if (r.abort) {
    // [1] => Client has called for the request to be aborted.
    abort();
    callback(new Error('Client issued abort')); // no retry
    return;
  }

  if (r.state.abortWithResponse) {
    // [2] => Plugin requested abort and specified alternative response.
    abort();
    sendResponseToClient(r.state.abortWithResponse, r.clientStream, r.clientCallback);
    var err = new Error('Plugin issued abort');
    err.skipClientCallback = true;
    callback(err); // no retry
    return;
  }

  if (r.state.retry && r.state.attempt < r.state.maxAttempt) {
    // [3] => One or more plugins have called for the request to be retried.
    abort();
    debug('Plugin issued a retry.');
    callback(); // retry
    return;
  }

  if (r.response) {
    // monkey-patch real abort function
    r.clientStream.abort = function() {
      debug('Client issued abort.');
      r.response.abort();
    };
  }

  if (r.state.retry) {
    debug('Failed to retry request. Too many retry attempts.');
    r.state.retry = false;
  }

  if (!r.state.sending) {
    // [4] => Request has not yet been sent. Still processing 'onRequest' hooks.
    callback(); // continue
    return;
  }

  if (r.response) {
    // pass response events/data to awaiting client
    if (r.eventRelay) {
      r.eventRelay.resume();
    }
    if (r.clientStream.destinations.length > 0) {
      r.response.pipe(r.clientStream.passThroughReadable);
    }
    r.response.resume();
  }

  // [5] => Return response to awaiting client.
  callback(new Error('No retry requested')); // no retry
};

// execute a specified hook for all plugins
var runHooks = function(hookName, r, data, end) {
  if (r.plugins.length === 0) {
    end(); // no plugins
  } else {
    async.eachSeries(r.plugins, function(plugin, done) {
      if (typeof plugin[hookName] !== 'function') {
        done(); // no hooks for plugin
      } else if (plugin.disabled) {
        debug(`Skipping hook ${hookName} for disabled plugin '${plugin.id}'.`);
        done();
      } else {
        debug(`Running hook ${hookName} for plugin '${plugin.id}'.`);
        var oldState = Object.assign({}, r.state);
        oldState.stash = r.plugin_stash[plugin.id]; // add stash
        plugin[hookName](oldState, data, function(newState) {
          updateState(r.state, newState, done);
        });
      }
    }, end);
  }
};

// wrap client callback to allow for plugin error hook execution
var wrapCallback = function(r, done) {
  if (typeof r.clientCallback === 'undefined') {
    return undefined; // noop
  } else {
    debug('Client callback specified.');
    // return wrapped callback
    return function(error, response, body) {
      if (error) {
        runHooks('onError', r, error, function() {
          processState(r, function(stop) {
            if (stop && !stop.skipClientCallback) {
              r.clientCallback(error, response, body);
            }
            done(stop);
          });
        });
      } else {
        r.clientCallback(error, response, body);
        // execute `done()` in response hook
      }
    };
  }
};

module.exports = {
  runHooks: runHooks,
  processState: processState,
  wrapCallback: wrapCallback
};
