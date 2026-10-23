/**
 * A chess puzzle room recorded before puzzles were a platform capability
 * (the chess-owned puzzle room of commit e9b95ed69) replays unchanged
 * through the platform's puzzle session that chess's registration now
 * installs: every command — as its stored and sent names spell it — is
 * answered with the same events or the same refusal, and leaves the same
 * puzzle room state, attribute for attribute.
 *
 * `fixtures/rooms/puzzle-session-log.json` is that recording: starts (an
 * unreadable position included), hints, a revealed solution move, wrong,
 * illegal and upper-case moves, a transposition, an alternative mate,
 * castling entered as king-onto-rook, stepping and seeking, showing the
 * solution, skipping, suggestions, reclaiming and clearing.
 */

import { expect, test } from 'bun:test';
import { createChessModule } from '@libs/chess-puzzle-harness-ts/chess-module';
import { HARNESS_CHESS_FIXTURES_DIR } from '@libs/chess-puzzle-harness-ts/chess-puzzles';
import type {
  HandleResult,
  RoomCommand,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';

type RecordedStep = {
  readonly identity: string;
  readonly command: RoomCommand;
  readonly result: HandleResult;
  readonly state: RoomState;
};

const recording = (await Bun.file(
  `${HARNESS_CHESS_FIXTURES_DIR}/rooms/puzzle-session-log.json`
).json()) as {
  readonly initial: RoomState;
  readonly log: readonly RecordedStep[];
};

/** The puzzle session's slice of the room: its durable attribute keys. */
function puzzleSlice(state: RoomState): RoomState {
  return Object.fromEntries(
    Object.entries(state)
      .filter(([key]) => key.startsWith('chess.puzzle.'))
      .sort(([a], [b]) => (a < b ? -1 : 1))
  );
}

test('the recording covers every puzzle command the session answers', () => {
  const names = new Set(
    recording.log.map((step) =>
      String((step.command.payload as { type: string }).type)
    )
  );
  expect([...names].sort()).toEqual(
    [
      'clear',
      'clear-recommendation',
      'reclaim',
      'recommend-move',
      'request-hint',
      'reset',
      'reveal-solution',
      'seek',
      'show-solution',
      'skip',
      'start',
      'step-back',
      'step-forward',
      'submit-move',
    ].map((name) => `chess-puzzle-play-cmd/${name}`)
  );
});

test('a chess puzzle room recorded before puzzles were a capability replays unchanged', () => {
  const room = createChessModule(() => 0);
  let state = room.initialState();
  expect(puzzleSlice(state)).toEqual(recording.initial);
  for (const [index, step] of recording.log.entries()) {
    const result = room.handle(state, step.command, step.identity);
    expect({ step: index + 1, result }).toEqual({
      step: index + 1,
      result: step.result,
    });
    if (result.ok)
      for (const event of result.events) state = room.reduce(state, event);
    expect({ step: index + 1, state: puzzleSlice(state) }).toEqual({
      step: index + 1,
      state: step.state,
    });
  }
});
