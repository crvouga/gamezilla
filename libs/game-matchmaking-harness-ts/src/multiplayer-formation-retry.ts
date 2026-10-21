import {
  FORMATION_RETRY_EVENT_PREFIX,
  scheduleFormationRetry,
} from '@libs/game-matchmaking-shared-ts/formation-retry';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const retryWaitingOpponents = scenarioAction({
  name: 'retryWaitingOpponents',
  act: (s) =>
    s.harness.serverSql.sqlClient.transaction((tx) =>
      scheduleFormationRetry(tx, s.harness.clock.now())
    ),
});

export async function opponentRetryDelays(s: ProductHarness) {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{ available_at: string }>`SELECT available_at FROM outbox_events
      WHERE id LIKE ${`${FORMATION_RETRY_EVENT_PREFIX}%`} AND deleted_at IS NULL`
  );
  return rows.map(
    (row) => new Date(row.available_at).getTime() - s.harness.clock.now()
  );
}
