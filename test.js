'use strict';

let assert = require('chai').assert;
let KindaMySQLStore = require('./src');

suite('KindaMySQLStore', function() {
  let store = KindaMySQLStore.create({ url: 'mysql://test@localhost/test' });

  suiteTeardown(async function() {
    await store.delRange();
  });

  test('simple put, get and del', async function() {
    let key = ['users', 'mvila'];
    await store.put(key, { firstName: 'Manu', age: 42 });
    let user = await store.get(key);
    assert.deepEqual(user, { firstName: 'Manu', age: 42 });
    let hasBeenDeleted = await store.del(key);
    assert.isTrue(hasBeenDeleted);
    user = await store.get(key, { errorIfMissing: false });
    assert.isUndefined(user);
    hasBeenDeleted = await store.del(key, { errorIfMissing: false });
    assert.isFalse(hasBeenDeleted);
  });

  test('change made inside a commited transaction', async function() {
    let key = ['users', 'mvila'];
    let user = { firstName: 'Manu', age: 42 };
    await store.put(key, user);
    assert.isFalse(store.isInsideTransaction);
    await store.transaction(async function(tr) {
      assert.isTrue(tr.isInsideTransaction);
      user = await tr.get(key);
      assert.strictEqual(user.firstName, 'Manu');
      user.firstName = 'Vince';
      await tr.put(key, user);
      user = await tr.get(key);
      assert.strictEqual(user.firstName, 'Vince');
    });
    user = await store.get(key);
    assert.strictEqual(user.firstName, 'Vince');
    await store.del(key);
  });

  test('change made inside an aborted transaction', async function() {
    let key = ['users', 'mvila'];
    let user = { firstName: 'Manu', age: 42 };
    await store.put(key, user);
    try {
      assert.isFalse(store.isInsideTransaction);
      await store.transaction(async function(tr) {
        assert.isTrue(tr.isInsideTransaction);
        user = await tr.get(key);
        assert.strictEqual(user.firstName, 'Manu');
        user.firstName = 'Vince';
        await tr.put(key, user);
        user = await tr.get(key);
        assert.strictEqual(user.firstName, 'Vince');
        throw new Error('something is wrong');
      });
    } catch (err) {
      // noop
    }
    user = await store.get(key);
    assert.strictEqual(user.firstName, 'Manu');
  });
});
