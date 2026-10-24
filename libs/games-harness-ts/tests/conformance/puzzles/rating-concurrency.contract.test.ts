import { expect, test } from 'bun:test';
import { puzzleOwnerKey } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { CONCURRENT_DRIVERS } from '@pkgs/sql-client-root-harness-ts/open-concurrent-postgres';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { forEveryTurnGame } from '../game-suite';
import { puzzleCase } from './puzzle-room';
import { openConcurrentHost } from './rating-concurrency-host';

forEveryTurnGame(import.meta.path, (game) => {
  const namespace = puzzleCase(game).puzzles.namespace;
  const profileId = puzzleOwnerKey(namespace, 'alice');
  test.each([...CONCURRENT_DRIVERS])(
    'overlapping device results both contribute to one coherent rating history (%s)',
    async (driver) => {
      // regression: puzzle-concurrent-results-lost-rating
      await using host = await openConcurrentHost(driver, profileId);
      const names = [`${namespace}puzzle-one`, `${namespace}puzzle-two`];
      const replies = await Promise.all(names.map((name) => host.send(name)));
      for (let i = 0; i < replies.length; i++) {
        if (replies[i]!.status === 500) {
          // A conflicting transaction is retryable; the same logical result is resubmitted.
          const retry = await host.send(names[i]!);
          expect(retry.status).toBe(200);
        } else expect(replies[i]!.status).toBe(200);
      }
      const history = await host.db.query(sql<{
        rating_before: number;
        rating_after: number;
      }>`
    SELECT rating_before, rating_after FROM chess_puzzle_rating_events WHERE owner_id = ${'alice'}
  `);
      expect(history).toHaveLength(2);
      const first = history.filter(
        (event) => Number(event.rating_before) === 1500
      );
      expect(first).toHaveLength(1);
      const second = history.find((event) => event !== first[0])!;
      expect(Number(second.rating_before)).toBe(Number(first[0]!.rating_after));
      const profile = await host.db.query(
        sql<{
          rating: number;
        }>`SELECT rating FROM chess_puzzle_profiles WHERE id = ${profileId}`
      );
      expect(Number(profile[0]?.rating)).toBe(Number(second.rating_after));
    },
    30000
  );
});
