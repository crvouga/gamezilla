import { expect, test } from 'bun:test';
import {
  boardSystem,
  configureBoard,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import { dragPiece } from '@pkgs/chess-board-root-harness-ts/interaction-actions';
import { readInteraction } from '@pkgs/chess-board-root-harness-ts/interaction-reads';
import { INITIAL } from '@pkgs/chess-board-root-harness-ts/positions';

/** The Italian Game after 3...Bc5, reached by Black's bishop from f8. */
const ITALIAN =
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const BC5 = { from: 'f8', to: 'c5' } as const;

// regression: chessboard-mid-game-last-move-unmarked — the Italian Game after 3...Bc5 opened with no mark on f8 or c5.
test('a board opened part-way through marks the move its parent names', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, {
    fen: ITALIAN,
    lastMove: BC5,
    interactive: true,
    animations: false,
  });
  expect((await board.read(readInteraction)).lastMoveMarks).toEqual([
    'last-move@c5',
    'last-move@f8',
  ]);
});

test('a supplied last move stays unmarked when last moves are hidden', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, {
    fen: ITALIAN,
    lastMove: BC5,
    highlightLastMove: false,
    animations: false,
  });
  expect((await board.read(readInteraction)).lastMoveMarks).toEqual([]);
});

test("the board's own move replaces the supplied one", async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, {
    fen: ITALIAN,
    lastMove: BC5,
    interactive: true,
    animations: false,
  });
  await board.apply(dragPiece, 'e1', 'g1');
  expect((await board.read(readInteraction)).lastMoveMarks).toEqual([
    'last-move@e1',
    'last-move@g1',
  ]);
});

test('a replaced position with no known move clears the supplied mark', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, {
    fen: ITALIAN,
    lastMove: BC5,
    animations: false,
  });
  await board.apply(configureBoard, {
    fen: INITIAL,
    fenSyncKey: 1,
    lastMove: null,
  });
  expect((await board.read(readInteraction)).lastMoveMarks).toEqual([]);
});
