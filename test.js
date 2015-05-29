'use strict';

require('co-mocha');
let assert = require('chai').assert;
let KindaMySQLStore = require('./src');

suite('KindaMySQLStore', function() {
  let store = KindaMySQLStore.create({ url: 'mysql://test@localhost/test' });

  suiteTeardown(function *() {
    yield store.delRange();
  });

  test('simple put, get and del', function *() {
    let key = ['users', 'mvila'];
    yield store.put(key, { firstName: 'Manu', age: 42 });
    let user = yield store.get(key);
    assert.deepEqual(user, { firstName: 'Manu', age: 42 });
    let hasBeenDeleted = yield store.del(key);
    assert.isTrue(hasBeenDeleted);
    user = yield store.get(key, { errorIfMissing: false });
    assert.isUndefined(user);
    hasBeenDeleted = yield store.del(key, { errorIfMissing: false });
    assert.isFalse(hasBeenDeleted);
  });
});
