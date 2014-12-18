'use strict';

var _ = require('lodash');
var wait = require('co-wait');
var mysql = require('kinda-mysql').create();
var SQLStore = require('kinda-store-sql');

var MySQLStore = SQLStore.extend('MySQLStore', function() {
  this.setCreator(function(url, options) {
    this.connection = mysql.createPool(url);
    this.connection.on('connection', function(connection) {
      var sql = 'SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE';
      connection.query(sql);
    });
    this.store = this;
    this.setOptions(options);
  });

  this.initializeDatabase = function *() {
    if (this.store.databaseHasBeenInitialized) return;
    var sql = "CREATE TABLE IF NOT EXISTS `pairs` (\
      `key` longblob NOT NULL,\
      `value` longblob,\
      PRIMARY KEY (`key`(256))\
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;";
    yield this.connection.query(sql);
    this.store.databaseHasBeenInitialized = true;
  };

  this.transaction = function *(fn, options) {
    if (this.store !== this)
      return yield fn(this); // we are already in a transaction
    yield this.initializeDatabase();
    var connection = yield this.connection.getConnection();
    try {
      var transaction = Object.create(this);
      transaction.connection = connection;
      var retries = 0;
      while (retries < 30) {
        yield connection.query('START TRANSACTION');
        try {
          var res = yield fn(transaction);
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

  this.close = function *() {
    yield this.connection.end();
  };
});

module.exports = MySQLStore;
