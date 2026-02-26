import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('interview.db');
const db = new Database(dbPath);

export function initDb() {
  const schemaPath = path.resolve('src/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database initialized');
}

export default db;
