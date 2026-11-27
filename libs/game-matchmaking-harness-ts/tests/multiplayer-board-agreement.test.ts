import { expect, test } from 'bun:test';
import { sameBoards } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { MATCH_GAME_KEY } from '@libs/game-matchmaking-shared-ts/match-room';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

const game = {
  id: 'match',
  white_id: 'alice',
  black_id: 'bob',
  fen: 'live-position',
  pgn: '',
  revision: 0,
  paused_at_ms: null,
  turn: '',
  outcome: 'black',
  reason: 'resignation',
};
const ongoing = { ...game, outcome: 'ongoing', reason: null };

function device(name: string, copy: typeof game | typeof ongoing) {
  return {
    sessionToken: () => null,
    memberId: () => name,
    currentPath: () => `/space/${name}-space`,
    localSql: () => ({
      query: async (q: { strings: readonly string[] }) =>
        q.strings.join('').includes('sync_engine_push_applied')
          ? [{ topic: `user:${name}`, last_push_seq: '7' }]
          : [copy],
    }),
    ui: {
      get: () => ({ layout: async () => null }),
      snapshotHtml: async () =>
        '<div data-testid="multiplayer-game" data-game-id="match" data-outcome="black" data-revision="0"></div>',
    },
  };
}

// regression: matched-winner-read-loses-device-state
test('after Alice resigns, a failed winner read identifies each device, the displayed boards, and the stored and live result', async () => {
  const harness = {
    actors: new Map([
      ['alice', device('alice', ongoing)],
      ['bob', device('bob', game)],
    ]),
    harness: {
      client: async () => ({}),
      serverSql: {
        sqlClient: {
          query: async (q: { strings: readonly string[] }) =>
            q.strings.join('').includes('sync_engine_topic_seq')
              ? [{ topic: 'user:alice', n: 8 }]
              : [game],
        },
      },
      roomNode: {
        services: { read: async () => ({ [MATCH_GAME_KEY]: game }) },
      },
    },
  } as unknown as ProductHarness;
  const world = {
    memo: new Map([['multiplayer:game', game]]),
    s: {
      read: (read: (s: ProductHarness) => unknown) => read(harness),
      until: async <T>(
        read: (s: ProductHarness) => Promise<T>,
        opts?: { pred: (value: T) => boolean }
      ) => {
        const value = await read(harness);
        if (opts ? opts.pred(value) : value) return value;
        throw new Error('until: predicate not met within 5000ms');
      },
    },
  } as unknown as HarnessWorld;
  const failure = await sameBoards(
    world,
    'alice',
    'bob',
    (g) => g.outcome === 'black'
  ).then(
    () => 'unexpected agreement',
    (error: Error) => error.message
  );
  for (const detail of [
    '5000ms',
    'alice.local=match@0:ongoing',
    'bob.local=match@0:black/resignation',
    'different=outcome,reason',
    'alice.pushFloor/allocated=user=7/8',
    'alice.screen=match@0:black',
    'bob.screen=match@0:black',
    'server=match@0:black/resignation',
    'room=match@0:black/resignation',
  ])
    expect(failure).toContain(detail);
});
