import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalDb = globalThis as unknown as {
  __magazineDb?: { db: DatabaseSync; filePath: string };
};

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "shipments.sqlite");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY,
      identity_key TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      magazine_name TEXT NOT NULL,
      ship_date TEXT NOT NULL,
      shipping_method TEXT NOT NULL,
      tracking_number TEXT NOT NULL,
      order_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shipments_phone ON shipments(phone);

    CREATE TABLE IF NOT EXISTS import_previews (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      file_ext TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      inserted_count INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      unchanged_count INTEGER NOT NULL,
      file_ext TEXT NOT NULL
    );
  `);
}

export function getDb(): DatabaseSync {
  const filePath = databasePath();
  const cached = globalDb.__magazineDb;
  if (cached && cached.filePath === filePath && cached.db.isOpen) return cached.db;
  if (cached?.db.isOpen) cached.db.close();

  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  globalDb.__magazineDb = { db, filePath };
  return db;
}

export function closeDb() {
  const cached = globalDb.__magazineDb;
  if (cached?.db.isOpen) cached.db.close();
  globalDb.__magazineDb = undefined;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
