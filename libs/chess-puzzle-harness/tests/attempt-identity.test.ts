import { expect, test } from 'bun:test';
import { createChessModule } from '@libs/chess-puzzle-harness/chess-module';
import {
  ClearPuzzlePlay,
  ResetPuzzlePlay,
  StartPuzzlePlay,
} from '@libs/game-puzzle-shared/play-messages';
import { PuzzleResultAttr } from '@libs/game-puzzle-shared/play-result';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared/types';

const ChessModule = createChessModule(() => 0);

function apply(
  state: RoomState,
  id: string,
  payload: RoomCommandPayload
): RoomState {
  const result = ChessModule.handle(
    state,
    { id, ts: 1700000000000, payload },
    'alice'
  );
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.events.reduce(
    (next, event) => ChessModule.reduce(next, event),
    state
  );
}

test('distinct starts at the same clock time retain distinct attempt identities', () => {
  // regression: puzzle-attempt-clock-identity-collision
  const start = StartPuzzlePlay({
    puzzleId: 'same-puzzle',
    fen: '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1',
    moves: 'e8d7 e1f2 d7e6 f2e3',
  });
  const first = apply(ChessModule.initialState(), 'first-start', start);
  const retried = apply(first, 'retry', ResetPuzzlePlay({}));
  const cleared = apply(retried, 'clear', ClearPuzzlePlay({}));
  const second = apply(cleared, 'second-start', start);
  expect(PuzzleResultAttr.attempt.from(first)).toBe('first-start');
  expect(PuzzleResultAttr.attempt.from(retried)).toBe('first-start');
  expect(PuzzleResultAttr.attempt.from(second)).toBe('second-start');
});
