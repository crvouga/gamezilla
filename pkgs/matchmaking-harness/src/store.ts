/**
 * Shared SQL store for matchmaking harness replicas (sqlite or mockingbird-postgres).
 */

import { Database } from 'bun:sqlite';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import type { MatchmakingHarnessBackend } from './harness-api';

export type HarnessStore = {
  readonly backend: MatchmakingHarnessBackend;
  /** Fresh SqlClient handle into the shared store (one per replica). */
  readonly openClient: () => SqlClient;
  readonly close: () => Promise<void>;
};

export async function openHarnessStore(
  backend: MatchmakingHarnessBackend
): Promise<HarnessStore> {
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
  const client = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
  await client.connect();
  const shared = new SqlClientImplAgnostic(client);
  return {
    backend,
    openClient: () => shared,
    close: () => client.disconnect(),
  };
}
