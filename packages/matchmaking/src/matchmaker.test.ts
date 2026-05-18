import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Matchmaker } from './matchmaker';
import { migrate } from './migrate';
import { createPgliteSqlClient } from './pglite-adapter';
import type { SqlClient } from './sql-client';
import type { MatchedPlayer } from './types';

type Harness = {
  db: PGlite;
  sqlClient: SqlClient;
};

async function bootHarness(): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  await migrate({ sqlClient });
  return { db, sqlClient };
}

let h: Harness;

beforeEach(async () => {
  h = await bootHarness();
});

afterEach(async () => {
  await h.db.close();
});

describe('Matchmaker.join / status / leave', () => {
  test('round-trips player data through status', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: () => {},
    });
    const joined = await mm.join({
      rating: 1500,
      data: { displayName: 'alice', accountId: 'acct_1' },
    });
    expect(typeof joined.playerId).toBe('string');

    const status = await mm.status(joined.playerId);
    expect(status).not.toBeNull();
    expect(status?.status).toBe('waiting');
    expect(status?.data).toEqual({
      displayName: 'alice',
      accountId: 'acct_1',
    });
  });

  test('status returns null for unknown id', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: () => {},
    });
    const missing = await mm.status('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });

  test('leave removes the row', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: () => {},
    });
    const { playerId } = await mm.join({ rating: 1000, data: {} });
    const result = await mm.leave(playerId);
    expect(result.removed).toBe(true);
    expect(await mm.status(playerId)).toBeNull();
  });
});

describe('Matchmaker.runMatchPass', () => {
  test('empty queue early-returns without invoking onMatch', async () => {
    let onMatchCalls = 0;
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: () => {
        onMatchCalls += 1;
      },
    });
    const result = await mm.runMatchPass();
    expect(result.matches).toBe(0);
    expect(onMatchCalls).toBe(0);
  });

  test('pairs two close-rated players and flips status to matched', async () => {
    const seen: MatchedPlayer[][] = [];
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: (group) => {
        seen.push([...group]);
      },
    });
    const a = await mm.join({ rating: 1000, data: { name: 'a' } });
    const b = await mm.join({ rating: 1020, data: { name: 'b' } });

    const result = await mm.runMatchPass();
    expect(result.matches).toBe(1);
    expect(seen.length).toBe(1);
    expect(seen[0]!.map((p) => p.playerId).sort()).toEqual(
      [a.playerId, b.playerId].sort()
    );
    expect(seen[0]!.map((p) => p.data['name']).sort()).toEqual(['a', 'b']);

    const aStatus = await mm.status(a.playerId);
    const bStatus = await mm.status(b.playerId);
    expect(aStatus?.status).toBe('matched');
    expect(bStatus?.status).toBe('matched');
  });

  test('no-match when ratings exceed both radii, then matches as time advances', async () => {
    const seen: MatchedPlayer[][] = [];
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: (group) => {
        seen.push([...group]);
      },
      now: () => now,
    });

    await mm.join({ rating: 1000, data: {} });
    await mm.join({ rating: 1200, data: {} });
    expect((await mm.runMatchPass()).matches).toBe(0);
    expect(seen.length).toBe(0);

    // Advance the simulated clock by 30s -> radius = 50 + 30*10 = 350.
    // Each player needs at least |1200-1000|=200 of mutual radius. Both
    // are 30s old in the matchmaker's eyes, so they qualify.
    now += 30_000;
    const result = await mm.runMatchPass();
    expect(result.matches).toBe(1);
  });

  test('matchSize=3 collects three close-rated players in one pass', async () => {
    const seen: MatchedPlayer[][] = [];
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      matchSize: 3,
      onMatch: (group) => {
        seen.push([...group]);
      },
    });
    await mm.join({ rating: 1000, data: {} });
    await mm.join({ rating: 1020, data: {} });
    await mm.join({ rating: 1040, data: {} });
    const result = await mm.runMatchPass();
    expect(result.matches).toBe(1);
    expect(seen[0]!.length).toBe(3);
  });

  test('concurrent passes do not double-match the same player', async () => {
    const seen: MatchedPlayer[][] = [];
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      onMatch: (group) => {
        seen.push([...group]);
      },
    });
    await mm.join({ rating: 1000, data: {} });
    await mm.join({ rating: 1010, data: {} });

    const [a, b] = await Promise.all([mm.runMatchPass(), mm.runMatchPass()]);
    expect(a.matches + b.matches).toBe(1);
    expect(seen.length).toBe(1);
  });
});
