/**
 * Process-wide PGlite handle for the sql-client PBT matrix.
 * Opening WASM per sample is too slow — reuse + DROP TABLE instead.
 */

import { PGlite } from '@electric-sql/pglite';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import type { SqlClient } from '../../interface';
import { createPgliteSqlClient } from '../../postgres/impl-pglite';
import { dropTables } from './drop-tables';
import type { MatrixBackend } from './types';

type SharedPglite = {
  readonly db: PGlite;
  readonly client: SqlClient;
};

let shared: SharedPglite | null = null;
let sharedPromise: Promise<SharedPglite> | null = null;

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

/** Test teardown: close the shared PGlite (optional; process exit also works). */
export async function closeSharedPglite(): Promise<void> {
  if (shared === null && sharedPromise === null) return;
  const live = await getSharedPglite();
  shared = null;
  sharedPromise = null;
  await live.db.close();
}
