// regression: people-search-rate-shared-server
/**
 * People search kept one rate-limit map for the whole process, keyed only by
 * account id. Parallel spec harnesses share that process, and quint traces
 * mint the same account ids, so one trace's searches emptied the next
 * trace's results. Each server's clock is its own bucket.
 */
import { describe, expect, test } from 'bun:test';
import { FRIENDS_QUERIES } from '@libs/friends/root/queries';
import { USER_SEARCH_RATE_LIMIT } from '@libs/user-search/public/user-search-types';

const VIEWER = 'account-shared-by-seed';

function steppingClock(start: number): () => Date {
  let at = start;
  return () => {
    const stamp = new Date(at);
    at += 1;
    return stamp;
  };
}

function searchCtx(now: () => Date, hits: { n: number }) {
  return {
    db: {
      query: async () => {
        hits.n += 1;
        return [];
      },
    },
    env: {
      actorId: VIEWER,
      deviceId: 'device',
      accountId: VIEWER,
      isAnon: false,
      now,
    },
  };
}

describe('people search rate limit', () => {
  test('a second server still answers after the first server is limited', async () => {
    const query = FRIENDS_QUERIES.find((q) => q.name === 'searchProfiles');
    if (query === undefined) throw new Error('searchProfiles missing');
    const hits = { n: 0 };
    const first = steppingClock(1_700_000_000_000);
    for (let i = 0; i < USER_SEARCH_RATE_LIMIT; i++) {
      await query.run(searchCtx(first, hits), { query: 'alice' } as never);
    }
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT);
    await query.run(searchCtx(first, hits), { query: 'alice' } as never);
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT);

    const second = steppingClock(1_700_000_000_000);
    await query.run(searchCtx(second, hits), { query: 'alice' } as never);
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT + 1);
  });
});
