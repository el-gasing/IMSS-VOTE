import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });

function parseEnvAdminUsernames(): string[] {
  return env.CAS_ADMIN_USERS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ui_subject_id TEXT NOT NULL UNIQUE,
      email_ui TEXT NOT NULL,
      wallet TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
      approved_at TIMESTAMPTZ NULL,
      tx_hash_whitelist TEXT NULL,
      nonce TEXT NULL,
      nonce_expires_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_set_updated_at ON registrations;
    CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON registrations
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations (status);
    CREATE INDEX IF NOT EXISTS idx_registrations_tx_hash ON registrations (tx_hash_whitelist);

    CREATE TABLE IF NOT EXISTS admin_users (
      username TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ui_subject_id TEXT NOT NULL UNIQUE,
      ketum_candidate_id BIGINT NOT NULL,
      waketum_candidate_id BIGINT NOT NULL,
      tx_hash_ketum TEXT NOT NULL UNIQUE,
      tx_hash_waketum TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_votes_ui_subject_id ON votes (ui_subject_id);
  `);

  const envAdmins = parseEnvAdminUsernames();
  for (const username of envAdmins) {
    await pool.query(`INSERT INTO admin_users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`, [username]);
  }
}

export async function isAdminUsername(username: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;
  const result = await pool.query(`SELECT 1 FROM admin_users WHERE username = $1 LIMIT 1`, [normalized]);
  return result.rows.length > 0;
}

export async function listAdminUsernames(): Promise<string[]> {
  const result = await pool.query(`SELECT username FROM admin_users ORDER BY username ASC`);
  return result.rows.map((row) => String(row.username));
}

export async function addAdminUsername(username: string): Promise<void> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return;
  await pool.query(`INSERT INTO admin_users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`, [normalized]);
}

export async function removeAdminUsername(username: string): Promise<void> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return;
  await pool.query(`DELETE FROM admin_users WHERE username = $1`, [normalized]);
}
