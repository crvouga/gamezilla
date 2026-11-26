import { expect, test } from 'bun:test';
import { seekGameOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { ProductHarness } from '@libs/harness-ts/harness';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openHarness } from './open-synthetic-population-harness';

async function waiting(s: ProductHarness): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    count: number | string;
  }>`
    SELECT COUNT(*) AS count FROM chess_opponent_searches
    WHERE standing = 'waiting' AND deleted_at IS NULL`);
  return Number(rows[0]?.count);
}

// regression: synthetic-opponent-search-survives-scenario
test('a synthetic population scenario leaves nobody waiting for a chess opponent', async () => {
  let waitingAtDisposal: number | undefined;
  {
    await using run = await openHarness({ mode: 'fast' });
    await run.apply(seekGameOpponent, 'Bob', 'chess');
    await run.until(waiting, { pred: (count) => count === 1, maxMs: 15000 });
    await run.read((s) => {
      const dispose = s.runtime.disposeResources.bind(s.runtime);
      s.runtime.disposeResources = async () => {
        try {
          waitingAtDisposal = await waiting(s);
        } finally {
          await dispose();
        }
      };
    });
  }
  expect(waitingAtDisposal).toBe(0);
});
