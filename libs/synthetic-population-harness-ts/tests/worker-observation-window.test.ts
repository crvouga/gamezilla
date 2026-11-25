import { expect, test } from 'bun:test';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { observeWorkerBeats } from '@libs/synthetic-population-harness-ts/population-worker';
import { workerNow } from '@libs/synthetic-population-harness-ts/worker-clock';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openHarness } from './open-synthetic-population-harness';

// regression: wall-clock-worker-observation-times-out
test('the worker endpoints record every five-second beat through fifteen minutes', async () => {
  await using world = await openHarness();
  const seen: number[] = [];
  await world.apply(
    scenarioAction({
      name: 'observeRecordedWorkerBeats',
      act: async (s) => {
        await observeWorkerBeats(s, 15 * 60_000, async () => {
          const now = workerNow(s.harness.clock);
          if (seen.length > 0) {
            const [latest] = await s.harness.serverSql.sqlClient.query(
              sql<{
                at: string | Date;
              }>`SELECT MAX(heartbeat_at) AS at FROM population_workers WHERE deleted_at IS NULL`
            );
            expect(new Date(latest!.at).getTime()).toBe(now);
          }
          seen.push(now);
        });
      },
    })
  );
  expect(seen.map((instant) => instant - seen[0]!)).toEqual(
    Array.from({ length: 181 }, (_, index) => index * 5_000)
  );
});
