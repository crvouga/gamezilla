import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Framework local tables for defineQuery sync (CACHE + DURABLE). */
export const FRAMEWORK_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS _mutations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS _upload_state (
  id TEXT PRIMARY KEY,
  last_acked_seq INTEGER NOT NULL DEFAULT 0,
  handoff_complete INTEGER NOT NULL DEFAULT 0,
  next_seq INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS _row_scopes (
  tbl TEXT NOT NULL,
  row_id TEXT NOT NULL,
  scope_hash TEXT NOT NULL,
  PRIMARY KEY (tbl, row_id, scope_hash)
);
CREATE INDEX IF NOT EXISTS idx_row_scopes_scope
  ON _row_scopes (scope_hash, tbl, row_id);
CREATE INDEX IF NOT EXISTS idx_row_scopes_row
  ON _row_scopes (tbl, row_id);
CREATE TABLE IF NOT EXISTS _scope_meta (
  scope_hash TEXT PRIMARY KEY,
  last_active_at TEXT NOT NULL,
  last_checkpoint TEXT,
  last_hash TEXT
);
`;

export const SCHEMA_EPOCH = 1;

export async function ensureFrameworkSchema(db: SqlClient): Promise<void> {
  const statements = FRAMEWORK_LOCAL_DDL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.run(unsafe(stmt));
  }
  const uploadColumns = await db.query(
    unsafe<{ name: string }>('PRAGMA table_info("_upload_state")')
  );
  if (!uploadColumns.some((column) => column.name === 'next_seq')) {
    await db.run(
      unsafe(
        'ALTER TABLE "_upload_state" ADD COLUMN "next_seq" INTEGER NOT NULL DEFAULT 1'
      )
    );
  }
  await db.run(
    unsafe(`
    INSERT OR IGNORE INTO _upload_state (
      id, last_acked_seq, handoff_complete, next_seq
    )
    VALUES ('singleton', 0, 0, 1)
  `)
  );
}
