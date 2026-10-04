import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared/sql';
import { openConcurrentHost } from './concurrent-host';
import { CONCURRENT_DRIVERS } from './concurrent-postgres';

test.each([...CONCURRENT_DRIVERS])(
  'overlapping device results both contribute to one coherent rating history (%s)',
  async (driver) => {
    // regression: puzzle-concurrent-results-lost-rating
    await using host = await openConcurrentHost(driver);
    const names = ['puzzle-one', 'puzzle-two'];
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
      }>`SELECT rating FROM chess_puzzle_profiles WHERE owner_id = ${'alice'}`
    );
    expect(Number(profile[0]?.rating)).toBe(Number(second.rating_after));
  },
  30000
);
