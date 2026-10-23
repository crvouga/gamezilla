/**
 * Shared SQL store for matchmaking harness replicas (sqlite or mockingbird-postgres).
 */

import { Database } from 'bun:sqlite';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import { SqlClientImplAgnostic } from '@pkgs/sql-client-root-shared-ts/impl-agnostic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import type { MatchmakingHarnessBackend } from './api';
import { openLiveStore } from './live-store';

export type HarnessStore = {
  readonly backend: MatchmakingHarnessBackend;
  /** Fresh SqlClient handle into the shared store (one per replica). */
  readonly openClient: () => SqlClient;
  readonly close: () => Promise<void>;
};

export async function openHarnessStore(
  backend: MatchmakingHarnessBackend
): Promise<HarnessStore> {
  if (backend === 'postgres-live') return openLiveStore();
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
