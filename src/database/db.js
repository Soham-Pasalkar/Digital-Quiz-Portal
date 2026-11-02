/**
 * Database Engine Initialization & Persistence Module
 * [Category A]: sql.js WebAssembly SQLite engine & database.sqlite persistence (STQA §3)
 * [Category B]: Atomic write persistence, foreign key enforcement, statement wrappers
 * [Category C]: Write-flush-rename persistence with documented durability boundaries
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { DEFAULT_DB_PATH } = require('../config/constants');

const DEFAULT_SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

class DatabaseClient {
  constructor(db, dbPath = DEFAULT_DB_PATH) {
    this.db = db;
    this.dbPath = dbPath;
    this.isClosed = false;

    // Enable SQLite foreign key constraint enforcement [Category B]
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE) with parameters.
   * @param {string} sql
   * @param {Array} [params=[]]
   * @returns {{ lastInsertRowid: number, changes: number }}
   */
  run(sql, params = []) {
    this._ensureOpen();
    this.db.run(sql, params);
    const meta = this.db.exec('SELECT last_insert_rowid() AS id, changes() AS changes;');
    const lastInsertRowid = meta[0]?.values[0]?.[0] || 0;
    const changes = meta[0]?.values[0]?.[1] || 0;
    return { lastInsertRowid, changes };
  }

  /**
   * Execute a query and return the first matching row as an object.
   * @param {string} sql
   * @param {Array} [params=[]]
   * @returns {Object|null}
   */
  get(sql, params = []) {
    this._ensureOpen();
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute a query and return all matching rows as an array of objects.
   * @param {string} sql
   * @param {Array} [params=[]]
   * @returns {Array<Object>}
   */
  all(sql, params = []) {
    this._ensureOpen();
    const stmt = this.db.prepare(sql);
    const results = [];
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute raw SQL string (e.g. DDL scripts, multi-statement migrations).
   * @param {string} sql
   */
  exec(sql) {
    this._ensureOpen();
    this.db.exec(sql);
  }

  /**
   * Export the in-memory SQLite database to disk using a write-flush-rename pattern.
   * [Category A & B]: STQA §3 saveDatabase() enhanced with POSIX atomic rename and fsync.
   * 
   * Atomicity and Durability Guarantees & Limitations:
   * 1. Atomicity:
   *    - Uses POSIX rename(2) (fs.renameSync) within the same filesystem directory.
   *    - Directory entry replacement is atomic: concurrent readers accessing destPath
   *      will always see either the complete pre-existing database file or the complete
   *      newly replaced file. Readers will never observe a partially written or truncated file.
   * 2. Durability:
   *    - Writes the SQLite binary buffer to a unique temporary sibling file (destPath.<ts>.<rnd>.tmp).
   *    - Explicitly invokes fs.fsyncSync(fd) to flush OS page cache dirty pages to non-volatile
   *      physical media before closing the file descriptor and renaming.
   * 3. Realistic Failure Boundaries & In-Flight Limitations:
   *    - Storage Controller Caching: Consumer-grade drives without battery-backed write caches
   *      (BBWC) or non-volatile write caches (NVRAM) may delay physical flash commits unless
   *      hardware-level cache flushes (e.g. macOS F_FULLFSYNC or Linux barriers) are supported
   *      and honored by the drive firmware.
   *    - In-Memory SQLite Volatility: Because sql.js is an in-memory WebAssembly SQLite engine,
   *      database mutations exist strictly in memory until db.save() is called. An unhandled
   *      process crash, SIGKILL, or system power failure between SQL operations and save()
   *      will lose changes made since the last save() invocation.
   *    - Filesystem Boundaries: Both the temporary file and destination file must reside on
   *      the same filesystem; otherwise, renameSync will fail with EXDEV. The temporary file is
   *      placed in the exact same directory as the target database to guarantee filesystem locality.
   * 
   * @param {string} [targetPath=null] - Optional override destination path
   * @returns {boolean} True if written and flushed, false if in-memory without path
   */
  save(targetPath = null) {
    this._ensureOpen();
    const destPath = targetPath || this.dbPath;

    if (!destPath || destPath === ':memory:') {
      return false;
    }

    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(destPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temporary sibling file in same directory, flush to disk, then rename
    const tempPath = `${destPath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeSync(fd, buffer);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    fs.renameSync(tempPath, destPath);

    // Directory entry sync where supported by the operating system / filesystem
    try {
      const dirFd = fs.openSync(dir, 'r');
      fs.fsyncSync(dirFd);
      fs.closeSync(dirFd);
    } catch {
      // Ignored if directory fsync is unsupported by OS/filesystem
    }

    return true;
  }

  /**
   * Close the database and release WebAssembly resources.
   * Automatically persists if a file path is bound.
   */
  close() {
    if (this.isClosed) return;
    if (this.dbPath && this.dbPath !== ':memory:') {
      this.save();
    }
    this.db.close();
    this.isClosed = true;
  }

  /**
   * Retrieve raw sql.js Database instance.
   */
  getRawDb() {
    this._ensureOpen();
    return this.db;
  }

  _ensureOpen() {
    if (this.isClosed) {
      throw new Error('DatabaseClient is closed. Cannot perform database operations.');
    }
  }
}

/**
 * Factory function to initialize and connect sql.js database.
 * Supports loading existing files, initializing fresh schema, or running in-memory.
 * 
 * @param {Object} [options={}]
 * @param {string} [options.dbPath=DEFAULT_DB_PATH] - Path to SQLite file or ':memory:'
 * @param {string} [options.schemaPath=DEFAULT_SCHEMA_PATH] - Path to DDL schema script
 * @param {boolean} [options.forceNew=false] - If true, ignores existing file and starts fresh
 * @returns {Promise<DatabaseClient>}
 */
async function initDatabase(options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  const schemaPath = options.schemaPath || DEFAULT_SCHEMA_PATH;
  const forceNew = options.forceNew || false;

  const SQL = await initSqlJs();
  let db;

  const isFileBacked = dbPath && dbPath !== ':memory:';
  const fileExists = isFileBacked && fs.existsSync(dbPath);

  if (fileExists && !forceNew) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const client = new DatabaseClient(db, dbPath);

  // If newly created database (or forced new), execute schema DDL
  if (!fileExists || forceNew) {
    if (fs.existsSync(schemaPath)) {
      const ddl = fs.readFileSync(schemaPath, 'utf8');
      client.exec(ddl);
      if (isFileBacked) {
        client.save();
      }
    }
  }

  return client;
}

module.exports = {
  DatabaseClient,
  initDatabase
};
