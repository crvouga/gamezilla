// @sql-vendor-ok — SQLite rebuild uses PRAGMA foreign_keys / legacy_alter_table.

import { asPhysicalIdent } from '@pkgs/db-schema-root-shared/index-fingerprint';
import { planClient } from '@pkgs/db-schema-root-shared/plan-client';
import type { Schema } from '@pkgs/db-schema-root-shared/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql, { ident, raw } from '@pkgs/sql-root-shared/sql';
import { readSqliteCatalog } from './catalog';
import { emitClientOperation } from './emit';

export type SqliteOwnership = 'whole-db' | 'declared-only';

export type SqliteDriverOptions = {
  /**
   * `declared-only` (default): leave undeclared tables alone (coexist with framework tables).
   * `whole-db`: drop undeclared tables — the bound DB is wholly owned.
   */
  readonly ownership?: SqliteOwnership;
};

export type SqliteDriver = {
  reconcile(): Promise<void>;
};

/** Staging prefix for a row-preserving rebuild (`_old_<table>`). */
const STAGING_PREFIX = '_old_';

/**
 * Finish any rebuild interrupted between `RENAME` and `DROP`.
 *
 * A staging table only ever holds the pre-rebuild rows, including retired
 * columns, so it always wins: drop whatever partial table exists under the real
 * name, rename staging back, and let the normal plan converge from a clean
 * state. Recovery therefore cannot lose data.
 *
 * Runs inside the same pragma bracket `runRebuild` uses: with `foreign_keys`
 * ON (the real client default) the `DROP` would delete the partial table's rows
 * and trip child `REFERENCES`, and the `RENAME` would rewrite those clauses to
 * point at a staging name. Either failure throws on every boot.
 */
async function recoverStagedRebuilds(
  client: SqlClient,
  foreignKeysWasOn: boolean
): Promise<void> {
  const rows = await client.query<{ name: string }>(
    raw(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_old\\_%' ESCAPE '\\' ORDER BY name`
    )
  );
  if (rows.length === 0) return;
  await setPragma(client, 'PRAGMA foreign_keys = OFF');
  await setPragma(client, 'PRAGMA legacy_alter_table = ON');
  try {
    for (const row of rows) {
      const base = row.name.slice(STAGING_PREFIX.length);
      let branded: string;
      try {
        branded = asPhysicalIdent(base);
      } catch {
        continue;
      }
      await client.run(sql`DROP TABLE IF EXISTS ${ident(branded)}`);
      await client.run(
        sql`ALTER TABLE ${ident(row.name)} RENAME TO ${ident(branded)}`
      );
    }
  } finally {
    await setPragma(client, 'PRAGMA legacy_alter_table = OFF');
    if (foreignKeysWasOn) {
      await setPragma(client, 'PRAGMA foreign_keys = ON');
    }
  }
}

async function readForeignKeysEnabled(client: SqlClient): Promise<boolean> {
  try {
    const rows = await client.query<{ foreign_keys: number }>(
      raw('PRAGMA foreign_keys')
    );
    return Number(rows[0]?.foreign_keys ?? 0) === 1;
  } catch {
    return false;
  }
}

async function setPragma(client: SqlClient, statement: string): Promise<void> {
  try {
    await client.run(raw(statement));
  } catch {
    // SQLite backend without the pragma (e.g. legacy_alter_table on an old
    // wasm build). Domain tables never depend on FK enforcement, so the only
    // loss is FK-repoint protection on rebuild — never copy correctness.
  }
}

/**
 * Run the rebuild with foreign keys off (their clauses must not be rewritten
 * to point at the staging table) and legacy ALTER semantics on.
 */
async function runRebuild(
  client: SqlClient,
  statements: readonly import('@pkgs/sql-root-shared/sql').Sql<unknown>[],
  foreignKeysWasOn: boolean
): Promise<void> {
  await setPragma(client, 'PRAGMA foreign_keys = OFF');
  await setPragma(client, 'PRAGMA legacy_alter_table = ON');
  try {
    for (const stmt of statements) {
      await client.run(stmt);
    }
  } finally {
    await setPragma(client, 'PRAGMA legacy_alter_table = OFF');
    if (foreignKeysWasOn) {
      await setPragma(client, 'PRAGMA foreign_keys = ON');
    }
  }
}

/**
 * SQLite schema reconciler.
 *
 * The client is a cache plus an upload queue, so undeclared columns are
 * preserved verbatim rather than treated as drift; declared-column type or
 * nullability mismatch still fails. Retired columns may be dropped on the
 * row-preserving rebuild. Undeclared tables are dropped only under
 * `ownership: 'whole-db'`.
 */
export function sqlite(
  schema: Schema,
  client: SqlClient,
  options?: SqliteDriverOptions
): SqliteDriver {
  const ownership = options?.ownership ?? 'declared-only';
  return {
    async reconcile(): Promise<void> {
      const declared = schema._declared;
      const foreignKeysWasOn = await readForeignKeysEnabled(client);
      await recoverStagedRebuilds(client, foreignKeysWasOn);
      // Do not wrap in `client.transaction()`: SQLite auto-commits DDL
      // (CREATE/ALTER/DROP), which fights the web SQLite backend's BEGIN/COMMIT
      // and surfaces as "Error finalizing statement" on OPFS. Interrupted
      // rebuilds are recovered by the staging sweep above.
      const catalog = await readSqliteCatalog(client);
      const plan = planClient(declared, catalog, { ownership });
      if (!plan.ok) {
        const detail = plan.drift
          .map((d) => `${d.path}: ${d.message}`)
          .join('\n');
        throw new Error(`db-schema sqlite reconcile drift:\n${detail}`);
      }
      for (const op of plan.operations) {
        const statements = emitClientOperation(op, declared);
        if (op.kind === 'rebuild_table') {
          await runRebuild(client, statements, foreignKeysWasOn);
          continue;
        }
        for (const stmt of statements) {
          await client.run(stmt);
        }
      }
    },
  };
}
