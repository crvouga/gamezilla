import { expect, test } from 'bun:test';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { confirmOfferedPosition } from '@pkgs/chess-board-harness/authority-actions';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import {
  boardSystem,
  configureBoard,
  movePiece,
  readBoard,
  readProbe,
  setupBoard,
} from '@pkgs/chess-board-harness/chess-board';
import { dragPiece } from '@pkgs/chess-board-harness/interaction-actions';
import {
  readAnnouncement,
  readCompletedFeedback,
  readMovePayloads,
} from '@pkgs/chess-board-harness/interaction-reads';
import { readOptions } from '@pkgs/chess-board-harness/options-reads';
import { INITIAL } from '@pkgs/chess-board-harness/positions';
import { readPremoves } from '@pkgs/chess-board-harness/premove-actions';
import type { Run } from '@pkgs/harness-shared/run-types';
import { Chess } from 'chess.js';
import { MIDDLEGAME } from './move-emission-contract-fixtures';
import { paintedPieces, payloadOf } from './move-emission-oracle';

async function assertCanonical(
  board: Run<BoardWorld>,
  oracle: Chess,
  moves: readonly Move[]
) {
  expect((await board.read(readProbe)).fen).toBe(oracle.fen());
  expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
  expect(await board.read(readMovePayloads)).toEqual([...moves]);
}

test('a supplied c7c5 reply preserves callback isolation and canonical metadata', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { animations: false });
  const oracle = new Chess(INITIAL);
  const offered = payloadOf(oracle.move({ from: 'e2', to: 'e4' }));
  await board.apply(dragPiece, 'e2', 'e4');
  await board.apply(confirmOfferedPosition);
  oracle.move({ from: 'c7', to: 'c5' });
  await board.apply(configureBoard, { fen: oracle.fen() });
  await assertCanonical(board, oracle, [offered]);
  expect((await board.read(readProbe)).lastMove).toEqual({
    from: 'c7',
    to: 'c5',
  });
  expect(await board.read(readAnnouncement)).toBe('Pawn to c5');
  expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'move',
    'move',
  ]);
  expect(await board.read(readMovePayloads)).toEqual([offered]);
});

test('literal unusable parent input retains a playable canonical board and recovers', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { animations: false });
  const oracle = new Chess(INITIAL);
  await board.apply(configureBoard, { fen: 'not a fen' });
  await assertCanonical(board, oracle, []);
  const offered = payloadOf(oracle.move({ from: 'e2', to: 'e4' }));
  await board.apply(dragPiece, 'e2', 'e4');
  await assertCanonical(board, oracle, [offered]);
  await board.apply(configureBoard, { fen: MIDDLEGAME });
  await assertCanonical(board, new Chess(MIDDLEGAME), [offered]);
  expect((await board.read(readProbe)).lastMove).toBeNull();
  await board.until(readCompletedFeedback, { maxMs: 1000 });
  expect(await board.read(readMovePayloads)).toEqual([offered]);
});

test('literal truncated initial FEN falls back to the complete playable opening', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { fen: '8/8/8 w - - 0 1', animations: false });
  const oracle = new Chess(INITIAL);
  await assertCanonical(board, oracle, []);
  const offered = payloadOf(oracle.move({ from: 'e2', to: 'e4' }));
  await board.apply(dragPiece, 'e2', 'e4');
  await assertCanonical(board, oracle, [offered]);
});

test.each([
  { name: 'selection', drag: false },
  { name: 'dragging', drag: true },
])(
  'ordered canonical premove callbacks use the real reply via $name',
  async (gesture) => {
    await using board = await boardSystem.run({ seed: 424242 });
    await board.apply(setupBoard, { premoves: true, animations: false });
    const oracle = new Chess(INITIAL);
    const moves: Move[] = [payloadOf(oracle.move({ from: 'e2', to: 'e4' }))];
    await board.apply(dragPiece, 'e2', 'e4');
    await board.apply(confirmOfferedPosition);
    await board.apply(gesture.drag ? dragPiece : movePiece, 'g1', 'f3');
    await board.apply(gesture.drag ? dragPiece : movePiece, 'f1', 'c4');
    await assertCanonical(board, oracle, moves);
    expect((await board.read(readPremoves)).queued).toEqual([
      { from: 'g1', to: 'f3' },
      { from: 'f1', to: 'c4' },
    ]);
    for (const entry of [
      { blackFrom: 'e7', blackTo: 'e5', whiteFrom: 'g1', whiteTo: 'f3' },
      { blackFrom: 'b8', blackTo: 'c6', whiteFrom: 'f1', whiteTo: 'c4' },
    ] as const) {
      oracle.move({ from: entry.blackFrom, to: entry.blackTo });
      const supplied = oracle.fen();
      moves.push(
        payloadOf(oracle.move({ from: entry.whiteFrom, to: entry.whiteTo }))
      );
      await board.apply(configureBoard, { fen: supplied });
      await assertCanonical(board, oracle, moves);
      expect((await board.read(readProbe)).lastMove).toEqual({
        from: entry.whiteFrom,
        to: entry.whiteTo,
      });
      await board.apply(confirmOfferedPosition);
      expect((await board.read(readOptions)).config.fen).toBe(oracle.fen());
      expect(await board.read(readMovePayloads)).toEqual(moves);
    }
    expect(await board.read(readPremoves)).toMatchObject({
      queued: [],
      previews: [],
    });
    expect(moves.map((m) => m.san)).toEqual(['e4', 'Nf3', 'Bc4']);
    await board.until(readCompletedFeedback, { maxMs: 1000 });
    expect(await board.read(readMovePayloads)).toEqual(moves);
  }
);

test('a blocked f1a6 premove contributes no extra callback after b7b5', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { premoves: true, animations: false });
  const oracle = new Chess(INITIAL);
  const offered = payloadOf(oracle.move({ from: 'e2', to: 'e4' }));
  await board.apply(dragPiece, 'e2', 'e4');
  await board.apply(confirmOfferedPosition);
  await board.apply(dragPiece, 'f1', 'a6');
  expect((await board.read(readPremoves)).queued).toEqual([
    { from: 'f1', to: 'a6' },
  ]);
  oracle.move({ from: 'b7', to: 'b5' });
  await board.apply(configureBoard, { fen: oracle.fen() });
  await assertCanonical(board, oracle, [offered]);
  expect(await board.read(readPremoves)).toMatchObject({
    queued: [],
    previews: [],
  });
  expect((await board.read(readProbe)).lastMove).toEqual({
    from: 'b7',
    to: 'b5',
  });
  await board.until(readCompletedFeedback, { maxMs: 1000 });
  expect(await board.read(readMovePayloads)).toEqual([offered]);
});

test('the literal rapid capture sequence emits each complete canonical payload once', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { animations: true });
  const oracle = new Chess(INITIAL);
  const moves: Move[] = [];
  for (const move of [
    { from: 'e2', to: 'e4' },
    { from: 'd7', to: 'd5' },
    { from: 'e4', to: 'd5' },
    { from: 'd8', to: 'd5' },
    { from: 'b1', to: 'c3' },
    { from: 'd5', to: 'a5' },
  ] as const) {
    moves.push(payloadOf(oracle.move(move)));
    await board.apply(dragPiece, move.from, move.to);
    await assertCanonical(board, oracle, moves);
    await board.apply(confirmOfferedPosition);
    expect((await board.read(readOptions)).config.fen).toBe(oracle.fen());
  }
  await board.until(readCompletedFeedback, { maxMs: 1000 });
  await assertCanonical(board, oracle, moves);
});
