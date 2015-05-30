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

  test('change made inside a commited transaction', function *() {
    let key = ['users', 'mvila'];
    let user = { firstName: 'Manu', age: 42 };
    yield store.put(key, user);
    assert.isFalse(store.isInsideTransaction());
    yield store.transaction(function *(tr) {
      assert.isTrue(tr.isInsideTransaction());
      user = yield tr.get(key);
      assert.strictEqual(user.firstName, 'Manu');
      user.firstName = 'Vince';
      yield tr.put(key, user);
      user = yield tr.get(key);
      assert.strictEqual(user.firstName, 'Vince');
    });
    user = yield store.get(key);
    assert.strictEqual(user.firstName, 'Vince');
    yield store.del(key);
  });

  test('change made inside an aborted transaction', function *() {
    let key = ['users', 'mvila'];
    let user = { firstName: 'Manu', age: 42 };
    yield store.put(key, user);
    try {
      assert.isFalse(store.isInsideTransaction());
      yield store.transaction(function *(tr) {
        assert.isTrue(tr.isInsideTransaction());
        user = yield tr.get(key);
        assert.strictEqual(user.firstName, 'Manu');
        user.firstName = 'Vince';
        yield tr.put(key, user);
        user = yield tr.get(key);
        assert.strictEqual(user.firstName, 'Vince');
        throw new Error('something is wrong');
      });
    } catch (err) {
      // noop
    }
    user = yield store.get(key);
    assert.strictEqual(user.firstName, 'Manu');
  });
});
