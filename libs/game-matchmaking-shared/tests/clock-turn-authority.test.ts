import { expect, test } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  clockLeftMs,
  multiplayerDeadlineMs,
  sideToMove,
  spendMultiplayerClock,
} from '@libs/game-matchmaking-shared/multiplayer-clock';

const game: MultiplayerGame = {
  id: 'match',
  white_id: 'first-person',
  black_id: 'second-person',
  turn: 'second-person',
  fen: 'c4:1:012',
  pgn: '012',
  revision: 3,
  outcome: 'ongoing',
  reason: null,
  time_control: '3+2',
  white_ms: 90_000,
  black_ms: 60_000,
  clock_at_ms: 1000,
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

// regression: shared-clock-parses-chess-position
test('clock ownership comes from the assigned participant, never position syntax', () => {
  expect(sideToMove(game)).toBe('black');
  expect(clockLeftMs(game, 'white', 4000)).toBe(90_000);
  expect(clockLeftMs(game, 'black', 4000)).toBe(57_000);
  expect(multiplayerDeadlineMs(game)).toBe(61_000);
  const played = spendMultiplayerClock(game, 4000);
  expect(played.white_ms).toBe(90_000);
  expect(played.black_ms).toBe(59_000);
  expect(played.clock_at_ms).toBe(4000);
  const firstTurn: MultiplayerGame = {
    ...game,
    turn: game.white_id,
    fen: 'opaque b',
  };
  expect(sideToMove(firstTurn)).toBe('white');
});
