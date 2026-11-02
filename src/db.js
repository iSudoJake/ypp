import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const path = process.env.DB_PATH || "data/economy.db";
mkdirSync(dirname(path), { recursive: true });

export const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    server_id  TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    username   TEXT,
    wallet     INTEGER NOT NULL DEFAULT 0 CHECK (wallet >= 0),
    bank       INTEGER NOT NULL DEFAULT 0 CHECK (bank >= 0),
    last_daily INTEGER NOT NULL DEFAULT 0,
    last_work  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS items (
    server_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    price       INTEGER NOT NULL CHECK (price > 0),
    description TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (server_id, name)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    server_id TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    item      TEXT NOT NULL,
    qty       INTEGER NOT NULL CHECK (qty > 0),
    PRIMARY KEY (server_id, user_id, item)
  );
`);
