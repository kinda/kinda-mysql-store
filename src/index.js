'use strict';

let mysql = require('kinda-mysql').create();
let util = require('kinda-util').create();
let KindaSQLStore = require('kinda-sql-store');

let KindaMySQLStore = KindaSQLStore.extend('KindaMySQLStore', function() {
  this.creator = function(options = {}) {
    this.connection = mysql.createPool(options.url);
    this.connection.on('connection', function(connection) {
      let sql = 'SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE';
      connection.query(sql);
    });
    this.store = this;
    this.setOptions(options);
  };

  this.initializeDatabase = async function() {
    if (this.store.databaseHasBeenInitialized) return;
    let sql = 'CREATE TABLE IF NOT EXISTS `pairs` (';
    sql += '`key` longblob NOT NULL, ';
    sql += '`value` longblob, ';
    sql += 'PRIMARY KEY (`key`(256))';
    sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8;';
    await this.connection.query(sql);
    this.store.databaseHasBeenInitialized = true;
  };

  this.transaction = async function(fn) {
    if (this.isInsideTransaction) return await fn(this);
    await this.initializeDatabase();
    let connection = await this.connection.getConnection();
    try {
      let transaction = Object.create(this);
      transaction.connection = connection;
      let retries = 0;
      while (retries < 30) {
        await connection.query('START TRANSACTION');
        try {
          let res = await fn(transaction);
          await connection.query('COMMIT');
          return res;
        } catch (err) {
          await connection.query('ROLLBACK');
          if (err.errno === 1205 || err.errno === 1213) {
            retries++;
            // console.log('retrying transaction (' + retries + ')');
            await util.timeout(100);
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

  Object.defineProperty(this, 'isInsideTransaction', {
    get() {
      return this !== this.store;
    }
  });

  this.close = async function() {
    await this.connection.end();
  };
});

module.exports = KindaMySQLStore;
