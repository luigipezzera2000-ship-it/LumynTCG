import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function checkDatabase() {
  await pool.query("SELECT 1");
}

export async function initializeDatabase() {
  const schemaExists = await pool.query("SELECT to_regclass('public.users') IS NOT NULL AS exists");
  if (!schemaExists.rows[0].exists) {
    const schema = await fs.readFile(path.join(projectRoot, "database", "schema.sql"), "utf8");
    await pool.query(schema);
    console.log("Database schema initialized");
  }
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false");

  const setCount = await pool.query("SELECT COUNT(*)::int AS count FROM sets");
  if (setCount.rows[0].count === 0) {
    const seed = await fs.readFile(path.join(projectRoot, "database", "seed.sql"), "utf8");
    await pool.query(seed);
    console.log("Database seed initialized");
  }
}
