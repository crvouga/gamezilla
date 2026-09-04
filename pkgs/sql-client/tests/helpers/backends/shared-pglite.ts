/**
 * Process-wide PGlite handle for the sql-client PBT matrix.
 * Opening WASM per sample is too slow — reuse + DROP TABLE instead.
 */

import { afterAll } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import type { SqlClient } from '../../../src/interface';
import { createPgliteSqlClient } from '../../../src/postgres/impl-pglite';
import { dropTables } from './drop-tables';
import type { MatrixBackend } from './types';

type SharedPglite = {
  readonly db: PGlite;
  readonly client: SqlClient;
};

let shared: SharedPglite | null = null;
let sharedPromise: Promise<SharedPglite> | null = null;
let closing: Promise<void> | null = null;

async function bootSharedPglite(): Promise<SharedPglite> {
  const db = await PGlite.create();
  const client = createPgliteSqlClient(db);
  await installPostgresSqliteCompat({ sqlClient: client });
  return { db, client };
}

export async function getSharedPglite(): Promise<SharedPglite> {
  if (shared !== null) return shared;
  if (sharedPromise === null) {
    sharedPromise = bootSharedPglite().then((next) => {
      shared = next;
      return next;
    });
  }
  return sharedPromise;
}

export async function openSharedPgliteBackend(): Promise<MatrixBackend> {
  const live = await getSharedPglite();
  return {
    kind: 'pglite',
    name: 'pglite',
    dialect: 'postgres',
    client: live.client,
    cleanup: (tables) => dropTables(live.client, tables, 'postgres'),
    close: async () => {
      // Shared across the suite — do not close per sample.
    },
  };
}

/** Test teardown: close the shared PGlite. Idempotent; WASM close may throw. */
export async function closeSharedPglite(): Promise<void> {
  if (closing !== null) {
    await closing;
    return;
  }
  if (shared === null && sharedPromise === null) return;
  closing = (async () => {
    try {
      const live = await getSharedPglite();
      shared = null;
      sharedPromise = null;
      await live.db.close();
    } catch {
      shared = null;
      sharedPromise = null;
    }
  })();
  await closing;
}

afterAll(async () => {
  await closeSharedPglite();
}, 30_000);
