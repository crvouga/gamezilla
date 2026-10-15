import { expect, test } from 'bun:test';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { ProductHarness } from '@libs/harness/harness';

// regression: browser-matchmaking-read-requires-inheap-database
test('a browser without an in-process database reads its rendered multiplayer snapshot', async () => {
  const snapshot = {
    game: {
      id: 'counting-match',
      fen: 'count:0',
      white_id: 'alice',
      black_id: 'bob',
      pgn: '',
      revision: 0,
      turn: 'alice',
      outcome: 'ongoing',
      reason: null,
      time_control: 'counting/5+0',
      white_ms: 300000,
      black_ms: 300000,
      clock_at_ms: 1000,
      paused_at_ms: null,
      draw_offer_by: null,
      rematch_offer_by: null,
      rematch_of: null,
      white_rating: null,
      black_rating: null,
      white_rating_diff: null,
      black_rating_diff: null,
    } satisfies MultiplayerGame,
    search: null,
    ratings: [],
  };
  const s = {
    actors: new Map([
      [
        'alice',
        {
          localSql: () => null,
          ui: {
            get: () => ({
              isVisible: async () => true,
              text: async () => JSON.stringify(snapshot),
            }),
          },
        },
      ],
    ]),
    harness: {
      client: async () => {
        throw new Error('No in-process browser client');
      },
    },
  } as unknown as ProductHarness;
  expect(await multiplayerView(s, 'alice')).toEqual(snapshot);
});

test('an unavailable browser multiplayer screen exposes no hidden match state', async () => {
  const s = {
    actors: new Map([
      [
        'alice',
        {
          localSql: () => null,
          ui: { get: () => ({ isVisible: async () => false }) },
        },
      ],
    ]),
  } as unknown as ProductHarness;
  expect(await multiplayerView(s, 'alice')).toEqual({
    game: null,
    search: null,
    ratings: [],
  });
});
