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

require('./index.js');

const assert = require('assert');
const fs = require('fs');
const http = require('http');

const c = Zone.current.fork({name: 'child_zone', properties: {a: 5}});

// Test Wrap and Async Propagation

fs.stat('~/', c.wrap(function() {
  assert.equal(Zone.current.get('a'), 5);
  fs.stat('~/', function() {
    // Should inherit queuing context
    assert.equal(Zone.current.get('a'), 5);
  });
}));

assert.equal(Zone.current.get('a'), undefined);

fs.stat('~/', function() {
  assert(!Zone.current.get('a'));
});

assert.equal(Zone.current.get('a'), undefined);

// Test Run

const result = c.run(function(i) {
  assert.equal(Zone.current.get('a'), 5);
  return i;
}, undefined, [12]);
assert(!Zone.current.get('a'));
assert.equal(result, 12);

assert.equal(Zone.current.get('a'), undefined);

// Test Timers

c.run(function() {
  const id = setInterval(function() {
    assert.equal(Zone.current.get('a'), 5);
    clearInterval(id);
  }, 5);
});

assert.equal(Zone.current.get('a'), undefined);

c.run(function() {
  setImmediate(function() {
    assert.equal(Zone.current.get('a'), 5);
  });
});

assert.equal(Zone.current.get('a'), undefined);

c.run(function() {
  setTimeout(function() {
    assert.equal(Zone.current.get('a'), 5);
  }, 5);
});

assert.equal(Zone.current.get('a'), undefined);

c.run(function() {
  process.nextTick(function() {
    assert.equal(Zone.current.get('a'), 5);
  });
});

assert.equal(Zone.current.get('a'), undefined);

// Test Async Event Emitter Pattern

c.run(function() {
  http.get('http://www.google.org/', function(res) {
    res.on('data', function() {
      assert.equal(Zone.current.get('a'), 5);
    });
    res.on('end', function() {
      assert.equal(Zone.current.get('a'), 5);
    });
  });
});

assert.equal(Zone.current.get('a'), undefined);

// Test Inherited Properties

c.run(function() {
  const c2 = Zone.current.fork({name: 'test_zone', properties: {b: 6}});
  c2.run(function() {
    assert.equal(Zone.current.get('a'), 5);
    assert.equal(Zone.current.get('b'), 6);
  });
});

assert.equal(Zone.current.get('a'), undefined);

// Test Native Promises

// Baseline

{
  let resolve;
  let results = [];

  results.push(Zone.current.get('a'));

  new Promise(function(r) {
    results.push(Zone.current.get('a'));
    resolve = r;
  }).then(function() {
    results.push(Zone.current.get('a'));
  });

  results.push(Zone.current.get('a'));
  resolve();
  setImmediate(function() {
    results.push(Zone.current.get('a'));
    results.forEach(function(result) {
      assert.equal(result, undefined);
    });
  });
}

// Should work with then

{
  let resolve;
  let result;

  c.run(function() {
    new Promise(function(r) {
      resolve = r;
    }).then(function() {
      result = Zone.current.get('a');
    });
  });

  resolve();
  setImmediate(function() {
    assert.equal(result, 5);
  });
}

// Should work with catch

{
  let reject;
  let result;

  c.run(function() {
    new Promise(function(_, r) {
      reject = r;
    })['catch'](function() {
      result = Zone.current.get('a');
    });
  });

  assert.equal(reject(), undefined);
  setImmediate(function() {
    assert.equal(result, 5);
  });
}
