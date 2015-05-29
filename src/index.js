'use strict';

let wait = require('co-wait');
let mysql = require('kinda-mysql').create();
let SQLStore = require('kinda-sql-store');

let MySQLStore = SQLStore.extend('MySQLStore', function() {
  this.creator = function(options = {}) {
    this.connection = mysql.createPool(options.url);
    this.connection.on('connection', function(connection) {
      let sql = 'SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE';
      connection.query(sql);
    });
    this.store = this;
    this.setOptions(options);
  };

  this.initializeDatabase = function *() {
    if (this.store.databaseHasBeenInitialized) return;
    let sql = 'CREATE TABLE IF NOT EXISTS `pairs` (';
    sql += '`key` longblob NOT NULL, ';
    sql += '`value` longblob, ';
    sql += 'PRIMARY KEY (`key`(256))';
    sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8;';
    yield this.connection.query(sql);
    this.store.databaseHasBeenInitialized = true;
  };

  this.transaction = function *(fn) {
    if (this.isInsideTransaction()) return yield fn(this);
    yield this.initializeDatabase();
    let connection = yield this.connection.getConnection();
    try {
      let transaction = Object.create(this);
      transaction.connection = connection;
      let retries = 0;
      while (retries < 30) {
        yield connection.query('START TRANSACTION');
        try {
          let res = yield fn(transaction);
          yield connection.query('COMMIT');
          return res;
        } catch (err) {
          yield connection.query('ROLLBACK');
          if (err.errno === 1205 || err.errno === 1213) {
            retries++;
            // console.log('retrying transaction (' + retries + ')');
            yield wait(100);
            continue; // retry the transaction
          }
          throw err;
        }
      }
      throw new Error('too many transaction retries');
    } finally {
      connection.release();
    }
  };

  this.isInsideTransaction = function() {
    return this !== this.store;
  };

  this.close = function *() {
    yield this.connection.end();
  };
});

module.exports = MySQLStore;
