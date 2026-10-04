import { expect, test } from 'bun:test';
import { createChessModule } from '@libs/chess-puzzle-shared/chess-module';
import { ChessPuzzleResultAttr } from '@libs/chess-puzzle-shared/chess-puzzle-result';
import { ClearChessPuzzlePlay, ResetChessPuzzlePlay, StartChessPuzzlePlay } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import type { RoomCommandPayload, RoomState } from '@pkgs/room-shared/types';

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
  const start = StartChessPuzzlePlay({
    puzzleId: 'same-puzzle',
    fen: '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1',
    moves: 'e8d7 e1f2 d7e6 f2e3',
  });
  const first = apply(ChessModule.initialState(), 'first-start', start);
  const retried = apply(first, 'retry', ResetChessPuzzlePlay({}));
  const cleared = apply(retried, 'clear', ClearChessPuzzlePlay({}));
  const second = apply(cleared, 'second-start', start);
  expect(ChessPuzzleResultAttr.attempt.from(first)).toBe('first-start');
  expect(ChessPuzzleResultAttr.attempt.from(retried)).toBe('first-start');
  expect(ChessPuzzleResultAttr.attempt.from(second)).toBe('second-start');
});
