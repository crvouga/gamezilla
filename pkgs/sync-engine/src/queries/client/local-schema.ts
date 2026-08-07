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
  created_at TEXT NOT NULL,
  epoch INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  acked_epoch INTEGER
);
CREATE TABLE IF NOT EXISTS _upload_state (
  id TEXT PRIMARY KEY,
  last_acked_seq INTEGER NOT NULL DEFAULT 0,
  handoff_complete INTEGER NOT NULL DEFAULT 0,
  next_seq INTEGER NOT NULL DEFAULT 1,
  write_epoch INTEGER NOT NULL DEFAULT 0
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
CREATE TABLE IF NOT EXISTS _peer_applied (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS _peer_mutations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  account_id TEXT,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS write_rejections (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS write_rejections_client_id_idx
  ON write_rejections (client_id);
CREATE INDEX IF NOT EXISTS write_rejections_mutation_id_idx
  ON write_rejections (mutation_id);
`;

export const SCHEMA_EPOCH = 1;

type ColumnRow = { readonly name: string };

async function tableColumns(
  db: SqlClient,
  table: string
): Promise<readonly ColumnRow[]> {
  return db.query(unsafe<ColumnRow>(`PRAGMA table_info("${table}")`));
}

async function ensureColumn(
  db: SqlClient,
  table: string,
  column: string,
  ddl: string
): Promise<void> {
  const columns = await tableColumns(db, table);
  if (columns.some((c) => c.name === column)) return;
  await db.run(unsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`));
}

/** Additive column / table upgrades for existing installs. */
export async function ensureOptimisticSchema(db: SqlClient): Promise<void> {
  await ensureColumn(
    db,
    '_upload_state',
    'next_seq',
    '"next_seq" INTEGER NOT NULL DEFAULT 1'
  );
  await ensureColumn(
    db,
    '_upload_state',
    'write_epoch',
    '"write_epoch" INTEGER NOT NULL DEFAULT 0'
  );
  await ensureColumn(
    db,
    '_mutations',
    'epoch',
    '"epoch" INTEGER NOT NULL DEFAULT 0'
  );
  await ensureColumn(
    db,
    '_mutations',
    'status',
    '"status" TEXT NOT NULL DEFAULT \'pending\''
  );
  await ensureColumn(db, '_mutations', 'acked_epoch', '"acked_epoch" INTEGER');
  await db.run(
    unsafe(`
    CREATE TABLE IF NOT EXISTS _peer_mutations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      args TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      account_id TEXT,
      client_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      epoch INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
  );
}

export async function ensureFrameworkSchema(db: SqlClient): Promise<void> {
  const statements = FRAMEWORK_LOCAL_DDL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.run(unsafe(stmt));
  }
  await ensureOptimisticSchema(db);
  await db.run(
    unsafe(`
    INSERT OR IGNORE INTO _upload_state (
      id, last_acked_seq, handoff_complete, next_seq, write_epoch
    )
    VALUES ('singleton', 0, 0, 1, 0)
  `)
  );
}
