import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const dbPath = path.resolve(process.cwd(), "data", "genesis.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

export type DbUser = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
};

export const findUserByUsername = (username: string) =>
  db
    .prepare("SELECT id, username, password_hash, created_at FROM users WHERE username = ?")
    .get(username) as DbUser | undefined;

export const findUserById = (id: string) =>
  db
    .prepare("SELECT id, username, password_hash, created_at FROM users WHERE id = ?")
    .get(id) as DbUser | undefined;

export const insertUser = (user: DbUser) => {
  db.prepare(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (@id, @username, @password_hash, @created_at)"
  ).run(user);
};
