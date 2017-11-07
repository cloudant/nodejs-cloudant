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
  if (r.abort) {
    // => client has called for the request to be aborted
    if (r.response) {
      debug('Client issued abort during plugin execution.');
      r.response.abort();
    }
    callback(new Error('Client issued abort')); // callback with error to prevent request retry
  } else if (r.state.abortWithResponse) {
    // => a plugin has requested an abort and an alternative response be returned to the client
    if (r.response) {
      r.response.abort();
    }
    sendResponseToClient(r.state.abortWithResponse, r.clientStream, r.clientCallback);
    var err = new Error('Plugin issued abort');
    err.skipClientCallback = true;
    callback(err); // callback with error to prevent request retry
  } else if (r.state.retry && r.state.attempt < r.state.cfg.maxAttempt) {
    // => one or more plugins have called for the request to be retried
    if (r.response) {
      r.response.abort();
    }
    debug('Plugin issued a retry.');
    callback(); // callback without error in order to retry the request
  } else {
    // => the response is "good" and can be returned to the awaiting client
    //    OR
    //    too many retry attempts; the "bad" response must be returned to the client
    if (r.response) {
      r.clientStream.abort = function() {
        debug('Client issued abort.');
        r.response.abort(); // monkey-patch real abort
      };
    }
    if (r.state.retry) {
      debug('Too many retry attempts.');
      r.state.retry = false;
    }
    if (!r.state.sending) {
      // request has not been sent, implies we are processing 'onRequest' hooks
      callback(); // callback without error to proceed with executing the client's request
    } else {
      // processing 'onError' or 'onResponse' hooks
      if (r.eventRelay) {
        // pass response through to awaiting client
        r.eventRelay.resume();
      }
      callback(new Error('No retry requested')); // no retry
    }
  }
};

// execute a specified hook for all plugins
var runHooks = function(hookName, r, data, end) {
  if (r.plugins.length === 0) {
    end(); // no plugins
  } else {
    async.eachSeries(r.plugins, function(plugin, done) {
      if (typeof plugin[hookName] !== 'function') {
        done(); // no hooks for plugin
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

// wrap client callback to allow for plugin hook execution
var wrapCallback = function(r, done) {
  if (typeof r.clientCallback === 'undefined') {
    debug('Running hooks using response event listener');
    return undefined; // noop
  } else {
    debug('Running hooks using wrapped client callback.');
    // return wrapped callback
    return function(error, response, body) {
      var cb = function() {
        processState(r, function(stop) {
          if (stop) {
            if (!stop.skipClientCallback) {
              debug('Running client callback...');
              r.clientCallback(error, response, body);
            }
            done(stop);
          } else {
            done();
          }
        });
      };
      if (error) {
        runHooks('onError', r, error, cb);
      } else {
        runHooks('onResponse', r, response, cb);
      }
    };
  }
};

module.exports = {
  runHooks: runHooks,
  processState: processState,
  wrapCallback: wrapCallback
};
