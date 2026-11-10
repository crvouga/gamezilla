import type {
  ObservatoryPorts,
  SyntheticUserOfAccount,
} from '@libs/observatory-server-ts/ports';
import { OBSERVATORY_TABLES } from '@libs/observatory-shared-ts/tables';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

/**
 * A User Observatory over its own tables, with a Synthetic Population that
 * knows the accounts `syntheticUsers` names and records each watch started.
 */
export async function observatoryFixture() {
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const { createId } = createHarnessIds(213);
  const db = SqlClientImplMockingbirdSqlite.open({
    seed: 213,
    now: () => new Date(clock.now()),
  });
  await reconcileSqliteSchema(
    db,
    registerTables([...OBSERVATORY_TABLES, ...PROFILE_TABLES])
  );
  const syntheticUsers = new Map<string, SyntheticUserOfAccount>();
  const watchesStarted: Record<string, string>[] = [];
  const notices: string[] = [];
  const ports: ObservatoryPorts = {
    clock,
    createId,
    population: {
      syntheticUsersOf: async (_tx, accountIds) =>
        new Map(
          accountIds.flatMap((id) => {
            const user = syntheticUsers.get(id);
            return user === undefined ? [] : [[id, user] as const];
          })
        ),
      recordWatchStarted: async (_tx, watch) => {
        watchesStarted.push({ ...watch });
      },
    },
    presenceChanged: async () => {
      notices.push('presence');
    },
    frameChanged: async (sessionId) => {
      notices.push(`frame:${sessionId}`);
    },
    wakeAccount: async (accountId) => {
      notices.push(`wake:${accountId}`);
    },
  };
  return {
    db,
    clock,
    createId,
    ports,
    syntheticUsers,
    watchesStarted: () => [...watchesStarted],
    notices: () => [...notices],
  };
}
