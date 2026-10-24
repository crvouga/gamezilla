/**
 * The deadline sweep and a person's command can reach one game at once.
 * Commands serialise on both people's owner lock (`lockOwners`); the sweep
 * takes it too, so a game ended while it waited is never ended again. The
 * transaction below models the lock: the sweep's request for it is granted
 * only after the competing resignation, which held it, has committed.
 */
import { expect, test } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { settleDueGame } from '@libs/game-matchmaking-shared-ts/settle-due-game';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { GameRules } from '@pkgs/turn-game-shared-ts/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

const rules: GameRules = {
  id: 'stub',
  recognizes: (position) => position.startsWith('stub:'),
  initial: () => 'stub:start',
  play: () => null,
  replay: () => 'stub:start',
  legal: () => [],
  canWin: () => true,
  moves: () => [],
};
const GAMES = createTurnGames([{ rules, capabilities: {} }]);

/** White to move after both moved, out of time at 1s on a 1+0 clock. */
const DUE: MultiplayerGame = {
  id: 'game-1',
  white_id: 'white-user',
  black_id: 'black-user',
  fen: 'stub:after-two',
  pgn: '',
  revision: 2,
  turn: 'white-user',
  outcome: 'ongoing',
  reason: null,
  time_control: '1+0',
  white_ms: 1_000,
  black_ms: 60_000,
  clock_at_ms: 0,
  paused_at_ms: null,
  draw_offer_by: null,
  rematch_offer_by: null,
  rematch_of: null,
  white_rating: null,
  black_rating: null,
  white_rating_diff: null,
  black_rating_diff: null,
  setup_ready: null,
};

// regression: matched-game-sweep-ends-a-game-twice
test('a game resigned while the sweep waited for its lock is not ended, rated or freed again', async () => {
  let game = DUE;
  let resignationWaiting = true;
  const writes: string[] = [];
  const text = (query: Sql<unknown>) => query.strings.join('?');
  const tx = {
    query: async (query: Sql<unknown>) => {
      const statement = text(query);
      if (statement.includes('INSERT INTO matchmaking_owners')) {
        // The resignation held this lock; it commits before the sweep gets it.
        if (resignationWaiting)
          game = {
            ...game,
            outcome: 'black',
            reason: 'resignation',
            revision: 3,
            white_rating_diff: -8,
            black_rating_diff: 8,
          };
        resignationWaiting = false;
        return [{ current_id: null, available: true }];
      }
      if (statement.includes('FROM chess_multiplayer_games')) return [game];
      writes.push(statement);
      return [];
    },
    run: async (query: Sql<unknown>) => {
      writes.push(text(query));
    },
  } as unknown as SqlTx;

  const notified = await settleDueGame(
    tx,
    { gameId: 'game-1', nowMs: 1_000, createId: () => 'id' },
    GAMES
  );

  expect(resignationWaiting).toBe(false);
  expect(notified).toEqual([]);
  expect(writes).toEqual([]);
  expect(game.reason).toBe('resignation');
});

// regression: obsolete-multiplayer-deadline-takes-owner-locks
test.each([
  { label: 'finished', game: { ...DUE, outcome: 'black' as const } },
  { label: 'moved to a later deadline', game: { ...DUE, white_ms: 2_000 } },
  { label: 'paused', game: { ...DUE, paused_at_ms: 500 } },
])(
  'an obsolete deadline for a game that is $label does not lock either player',
  async ({ game }) => {
    let reads = 0;
    const writes: string[] = [];
    const tx = {
      query: async () => {
        reads++;
        return [game];
      },
      run: async (query: Sql<unknown>) => {
        writes.push(query.strings.join('?'));
      },
    } as unknown as SqlTx;
    expect(
      await settleDueGame(
        tx,
        { gameId: 'game-1', nowMs: 1_000, createId: () => 'id' },
        GAMES
      )
    ).toEqual([]);
    expect(reads).toBe(1);
    expect(writes).toEqual([]);
  }
);
