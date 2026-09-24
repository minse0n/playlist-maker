import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "cache.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS search_cache (
      cache_key TEXT PRIMARY KEY,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      hints_json TEXT NOT NULL,
      candidates_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quota_usage (
      usage_date TEXT PRIMARY KEY,
      units_used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlist_runs (
      run_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      playlist_id TEXT,
      state_json TEXT NOT NULL
    );
  `);

  return db;
}
