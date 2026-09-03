/**
 * Shared SQL store for matchmaking sim replicas (sqlite or PGlite).
 */

import { Database } from 'bun:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { MatchmakingSimBackend } from './sim-api';

export type SimStore = {
  readonly backend: MatchmakingSimBackend;
  /** Fresh SqlClient handle into the shared store (one per replica). */
  readonly openClient: () => SqlClient;
  readonly close: () => Promise<void>;
};

export async function openSimStore(
  backend: MatchmakingSimBackend
): Promise<SimStore> {
  if (backend === 'sqlite') {
    const db = new Database(':memory:');
    const shared = new SqlClientImplAgnostic(new SqlClientImplBunSqlite(db));
    return {
      backend,
      openClient: () => shared,
      close: async () => {
        db.close(false);
      },
    };
  }
  const db = await PGlite.create();
  return {
    backend,
    openClient: () => new SqlClientImplAgnostic(createPgliteSqlClient(db)),
    close: async () => {
      await db.close();
    },
  };
}
