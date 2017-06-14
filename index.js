/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const asyncWrap = require('async_hooks');

const wrappedSymbol = Symbol('context_wrapped');
const contexts = {};
global.Zone = {
  current: new Context({ properties: {}, name: 'global_zone' })
};

const asyncHook = asyncWrap.createHook({init, before, destroy});
asyncHook.enable();

// Core Zone Api

function Context(zoneSpec, parent) {
  validateZoneSpec(zoneSpec);
  this.properties = zoneSpec.properties || {};
  this.name = zoneSpec.name;
  this.parent = parent;
}

Context.prototype.get = function(key) {
  const val = this.properties[key];
  return val || !this.parent ? val : this.parent.get(key);
};

Context.prototype.fork = function(zoneSpec) {
  return new Context(zoneSpec, this);
};

Context.prototype.wrap = function(cb, source) {
  if (cb[wrappedSymbol]) {
    return cb;
  }
  const oldContext = Zone.current;
  const thisContext = this;
  const wrapped = function() {
    Zone.current = thisContext;
    const res = cb.apply(this, arguments);
    Zone.current = oldContext;
    return res;
  };
  wrapped[wrappedSymbol] = true;
  return wrapped;
};

Context.prototype.run = function(cb, applyThis, applyArgs, source) {
  const oldContext = Zone.current;
  Zone.current = this;
  const res = cb.apply(applyThis, applyArgs);
  Zone.current = oldContext;
  return res;
};

// Unsupported Api

Context.prototype.runGuarded = function() {
  throw new Error('runGuarded is currently unsupported');
};

Context.prototype.runTask = function() {
  throw new Error('runTask is currently unsupported');
};

Context.prototype.scheduleMicroTask = function() {
  throw new Error('scheduleMicroTask is currently unsupported');
};

Context.prototype.scheduleMacroTask = function() {
  throw new Error('scheduleMacroTask is currently unsupported');
};

Context.prototype.scheduleEventTask = function() {
  throw new Error('scheduleEventTask is currently unsupported');
};

Context.prototype.cancelTask = function() {
  throw new Error('cancelTask is currently unsupported');
};

function validateZoneSpec(zoneSpec) {
  const interceptors = ['onFork', 'onIntercept', 'onInvoke', 'onHandleError',
                        'onScheduleTask', 'onInvokeTask', 'onCancelTask',
                        'onHasTask'];
  for (var i = 0; i < interceptors.length; i++) {
    if (zoneSpec[interceptors[i]])
      throw new Error(interceptors[i] + ' is currently unsupported');
  }
}

// AsyncWrap Hooks

function init(asyncId, type, triggerId, resource) {
  contexts[asyncId] = Zone.current;
}

function before(asyncId) {
  Zone.current = contexts[asyncId];
}

function destroy(asyncId) {
  delete contexts[asyncId];
}
