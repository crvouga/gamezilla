import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
// @sql-vendor-ok — SQLite rebuild uses PRAGMA foreign_keys / legacy_alter_table.

import { asPhysicalIdent } from '@pkgs/db-schema-root-shared-ts/index-fingerprint';
import { planClient } from '@pkgs/db-schema-root-shared-ts/plan-client';
import type { Schema } from '@pkgs/db-schema-root-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { ident, raw } from '@pkgs/sql-root-shared-ts/sql';
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
 * A cache reset discards the current table and any interrupted rebuild of it.
 * Keep the staging convention inside the SQLite adapter.
 */
export async function dropSqliteTables(
  client: SqlClient,
  names: readonly string[],
  existing: ReadonlySet<string>
): Promise<void> {
  const physical = new Map(
    Array.from(existing, (name) => [name.toLowerCase(), name])
  );
  for (const name of names) {
    const key = name.toLowerCase();
    for (const candidate of [key, STAGING_PREFIX + key]) {
      const table = physical.get(candidate);
      if (table !== undefined) {
        await client.run(
          raw(`DROP TABLE IF EXISTS "${asPhysicalIdent(table)}"`)
        );
      }
    }
  }
}

/**
 * Finish any rebuild interrupted between `RENAME` and `DROP`.
 *
 * A staging table only ever holds the pre-rebuild rows, including retired
 * columns, so it always wins: drop whatever partial table exists under the real
 * name, rename staging back, and let the normal plan converge from a clean
 * state. Recovery therefore cannot lose data.
 *
 * Only staging tables of owned tables are recovered: under `declared-only`
 * another owner's `_old_<name>` is not ours to rename over its `<name>`.
 *
 * Runs inside the same pragma bracket `runRebuild` uses: with `foreign_keys`
 * ON (the real client default) the `DROP` would delete the partial table's rows
 * and trip child `REFERENCES`, and the `RENAME` would rewrite those clauses to
 * point at a staging name. Either failure throws on every boot.
 */
async function recoverStagedRebuilds(
  client: SqlClient,
  foreignKeysWasOn: boolean,
  owns: (table: string) => boolean
): Promise<void> {
  const rows = await client.query<{ name: string }>(
    raw(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_old\\_%' ESCAPE '\\' ORDER BY name`
    )
  );
  const staged = rows.flatMap((row) => {
    const base = row.name.slice(STAGING_PREFIX.length);
    if (!owns(base)) return [];
    try {
      return [{ staging: row.name, table: asPhysicalIdent(base) }];
    } catch {
      return [];
    }
  });
  if (staged.length === 0) return;
  await setPragma(client, 'PRAGMA foreign_keys = OFF');
  await setPragma(client, 'PRAGMA legacy_alter_table = ON');
  try {
    for (const { staging, table } of staged) {
      await client.run(sql`DROP TABLE IF EXISTS ${ident(table)}`);
      await client.run(
        sql`ALTER TABLE ${ident(staging)} RENAME TO ${ident(table)}`
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
  statements: readonly Sql<unknown>[],
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
      const declaredNames = new Set(Object.keys(declared.tables));
      const foreignKeysWasOn = await readForeignKeysEnabled(client);
      await recoverStagedRebuilds(
        client,
        foreignKeysWasOn,
        (table) => ownership === 'whole-db' || declaredNames.has(table)
      );
      // Do not wrap in `client.transaction()`: SQLite auto-commits DDL
      // (CREATE/ALTER/DROP), which fights the web SQLite backend's BEGIN/COMMIT
      // and surfaces as "Error finalizing statement" on OPFS. Interrupted
      // rebuilds are recovered by the staging sweep above.
      // The plan reads columns and indexes of declared tables only; undeclared
      // tables need just their names (dropped under `whole-db`).
      const catalog = await readSqliteCatalog(client, declaredNames);
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
