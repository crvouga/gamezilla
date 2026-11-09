// regression: people-search-rate-shared-server
/**
 * People search kept one rate-limit map for the whole process, keyed only by
 * account id. Parallel spec harnesses share that process, and quint traces
 * mint the same account ids, so one trace's searches emptied the next
 * trace's results. Each server's clock is its own bucket.
 */
import { describe, expect, test } from 'bun:test';
import { FRIENDS_QUERIES } from '@libs/friends-shared-ts/queries';
import {
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
} from '@libs/user-search-shared-ts/user-search-types';

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
  // regression: people-search-rate-shared-server
  // regression: people-search-rate-says-nobody
  test('a name already searched still runs after other names fill the budget', async () => {
    const query = FRIENDS_QUERIES.find((q) => q.name === 'searchProfiles');
    if (query === undefined) throw new Error('searchProfiles missing');
    const hits = { n: 0 };
    const first = steppingClock(1_700_000_000_000);
    for (let i = 0; i < USER_SEARCH_RATE_LIMIT; i++) {
      await query.run(searchCtx(first, hits), {
        query: `name${String(i)}`,
      } as never);
    }
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT);
    // regression: people-search-limit-false-empty
    await expect(
      query.run(searchCtx(first, hits), { query: 'bob' } as never)
    ).rejects.toThrow('Too many searches. Wait a minute and try again.');
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT);
    await query.run(searchCtx(first, hits), { query: 'name0' } as never);
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT + 1);

    const second = steppingClock(1_700_000_000_000);
    await query.run(searchCtx(second, hits), { query: 'bob' } as never);
    expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT + 2);
  });
});

// regression: people-search-same-tick-bypasses-limit
test('searches within the same millisecond still consume the quota and recover at the window boundary', async () => {
  const query = FRIENDS_QUERIES.find((item) => item.name === 'searchProfiles');
  if (query === undefined) throw new Error('searchProfiles missing');
  let nowMs = 1_700_000_000_000;
  const now = () => new Date(nowMs);
  const hits = { n: 0 };
  for (let index = 0; index < USER_SEARCH_RATE_LIMIT; index += 1) {
    await query.run(searchCtx(now, hits), { query: `name${index}` } as never);
  }
  await expect(
    query.run(searchCtx(now, hits), { query: 'newname' } as never)
  ).rejects.toThrow('Too many searches');
  expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT);
  nowMs += USER_SEARCH_RATE_WINDOW_MS;
  await query.run(searchCtx(now, hits), { query: 'newname' } as never);
  expect(hits.n).toBe(USER_SEARCH_RATE_LIMIT + 1);
});
