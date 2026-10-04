import { expect, test } from 'bun:test';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { beginDrag, boardSystem, movePiece, readBoard, readProbe, selectSquare, setupBoard } from '@pkgs/chess-board-harness/chess-board';
import { cancelPromotion, choosePromotion, dragPiece, dropHeldPieceAtRatio } from '@pkgs/chess-board-harness/interaction-actions';
import { readAnnouncement, readCompletedFeedback, readMovePayloads } from '@pkgs/chess-board-harness/interaction-reads';
import { Chess, SQUARES } from 'chess.js';
import {
  EMISSION_CASES,
  MATE_IN_ONE,
  MIDDLEGAME,
  NO_EFFECT_CASES,
  PROMOTION_CHOICES,
  REFUSAL_INPUTS,
  SELECTION_CASES,
  START,
  WHITE_PROMOTION,
} from './move-emission-contract-fixtures';
import {
  legalDestinations,
  paintedPieces,
  payloadOf,
} from './move-emission-oracle';

test.each(EMISSION_CASES)(
  '$name emits exactly the complete public move payload and canonical FEN',
  async (entry) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const input = entry.position;
    const oracle = new Chess(input.fen);
    const expected = payloadOf(
      oracle.move({
        from: input.from,
        to: input.to,
        ...(input.promotion === undefined
          ? {}
          : { promotion: input.promotion }),
      })
    );
    await board.apply(setupBoard, {
      fen: input.fen,
      animations: false,
      orientation: input.orientation ?? 'white',
    });
    const target = input.inputTo ?? input.to;
    if (entry.gesture === 'drag')
      await board.apply(dragPiece, input.from, target);
    else
      await board.apply(
        movePiece,
        input.from,
        target,
        entry.gesture === 'keyboard'
      );
    if (input.promotion !== undefined) {
      expect(await board.read(readMovePayloads)).toEqual([]);
      expect((await board.read(readProbe)).promotion).toEqual({
        from: input.from,
        to: input.to,
        color: new Chess(input.fen).turn(),
      });
      await board.apply(choosePromotion, PROMOTION_CHOICES[input.promotion]);
    }
    expect(await board.read(readMovePayloads)).toEqual([expected]);
    expect(await board.read(readProbe)).toMatchObject({
      fen: oracle.fen(),
      lastMove: { from: input.from, to: input.to },
    });
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
    if (input.announcement !== undefined)
      expect(await board.read(readAnnouncement)).toBe(input.announcement);
    await board.until(readCompletedFeedback, { maxMs: 1000 });
    expect(await board.read(readMovePayloads)).toEqual([expected]);
  }
);

test('the declared six-ply opening emits one isolated canonical callback per ply', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { fen: START, animations: false });
  const oracle = new Chess(START);
  const expected: Move[] = [];
  const line = [
    { from: 'e2', to: 'e4', drag: true },
    { from: 'e7', to: 'e5', drag: false },
    { from: 'g1', to: 'f3', drag: true },
    { from: 'b8', to: 'c6', drag: false },
    { from: 'f1', to: 'b5', drag: true },
    { from: 'a7', to: 'a6', drag: false },
  ] as const;
  for (const input of line) {
    expected.push(payloadOf(oracle.move(input)));
    await board.apply(input.drag ? dragPiece : movePiece, input.from, input.to);
    expect(await board.read(readMovePayloads)).toEqual(expected);
    expect(await board.read(readProbe)).toMatchObject({
      fen: oracle.fen(),
      lastMove: { from: input.from, to: input.to },
    });
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
  }
  expect(expected.map((move) => move.san)).toEqual([
    'e4',
    'e5',
    'Nf3',
    'Nc6',
    'Bb5',
    'a6',
  ]);
  expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual(
    Array(6).fill('move')
  );
  expect(await board.read(readMovePayloads)).toEqual(expected);
});

test.each(SELECTION_CASES)(
  'complete destination sets equal the independent rules for %s',
  async (fen) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const oracle = new Chess(fen);
    await board.apply(setupBoard, { fen, animations: false });
    const own = SQUARES.filter(
      (square) => oracle.get(square)?.color === oracle.turn()
    );
    for (const square of own) {
      await board.apply(selectSquare, square);
      expect(await board.read(readProbe)).toMatchObject({
        fen: oracle.fen(),
        selected: square,
        legalTargets: legalDestinations(oracle, square),
        lastMove: null,
      });
      expect(await board.read(readMovePayloads)).toEqual([]);
      await board.apply(selectSquare, square);
      expect(await board.read(readProbe)).toMatchObject({
        selected: null,
        legalTargets: [],
      });
      expect((await board.read(readBoard)).pieces).toEqual(
        paintedPieces(oracle)
      );
    }
    expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual(
      []
    );
  }
);

test.each([false, true])(
  'cancelling an earlier promotion (Escape=%s) permits one later capture-promotion callback',
  async (escape) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const oracle = new Chess(WHITE_PROMOTION);
    await board.apply(setupBoard, { fen: WHITE_PROMOTION, animations: false });
    await board.apply(dragPiece, 'a7', 'a8');
    await board.apply(cancelPromotion, escape);
    expect(await board.read(readMovePayloads)).toEqual([]);
    expect(await board.read(readProbe)).toMatchObject({
      fen: oracle.fen(),
      promotion: null,
    });
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
    await board.apply(dragPiece, 'a7', 'b8');
    expect(await board.read(readMovePayloads)).toEqual([]);
    await board.apply(choosePromotion, 'queen');
    const expected = payloadOf(
      oracle.move({ from: 'a7', to: 'b8', promotion: 'q' })
    );
    expect(await board.read(readMovePayloads)).toEqual([expected]);
    expect((await board.read(readProbe)).fen).toBe(oracle.fen());
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
    await board.until(readCompletedFeedback, { maxMs: 1000 });
    expect(await board.read(readMovePayloads)).toEqual([expected]);
  }
);

test('automatic queen promotion emits one canonical callback without a pending choice', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  const oracle = new Chess(WHITE_PROMOTION);
  const expected = payloadOf(
    oracle.move({ from: 'a7', to: 'a8', promotion: 'q' })
  );
  await board.apply(setupBoard, {
    fen: WHITE_PROMOTION,
    animations: false,
    autoPromoteQueen: true,
  });
  await board.apply(dragPiece, 'a7', 'a8');
  expect(await board.read(readMovePayloads)).toEqual([expected]);
  expect(await board.read(readProbe)).toMatchObject({
    fen: oracle.fen(),
    promotion: null,
  });
  expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
  await board.until(readCompletedFeedback, { maxMs: 1000 });
  expect(await board.read(readMovePayloads)).toEqual([expected]);
});

test('switching between each own middlegame piece only changes selection and never emits feedback', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  const oracle = new Chess(MIDDLEGAME);
  await board.apply(setupBoard, { fen: MIDDLEGAME, animations: false });
  for (const square of SQUARES.filter(
    (at) => oracle.get(at)?.color === oracle.turn()
  )) {
    await board.apply(selectSquare, square);
    expect(await board.read(readProbe)).toMatchObject({
      fen: oracle.fen(),
      selected: square,
      legalTargets: legalDestinations(oracle, square),
    });
    expect(await board.read(readMovePayloads)).toEqual([]);
  }
  expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([]);
  expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
});

test.each(NO_EFFECT_CASES)(
  '$name have no event, position or sound effect',
  async (input) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const oracle = new Chess(input.fen);
    const candidates = SQUARES.filter(
      (square) =>
        !input.interactive ||
        oracle.isGameOver() ||
        oracle.get(square)?.color !== oracle.turn()
    );
    expect(candidates).toHaveLength(
      input.interactive && !oracle.isGameOver() ? 48 : 64
    );
    await board.apply(setupBoard, {
      fen: input.fen,
      interactive: input.interactive,
      animations: false,
    });
    for (const square of candidates) {
      await board.apply(selectSquare, square);
      expect(await board.read(readProbe)).toMatchObject({
        fen: oracle.fen(),
        selected: null,
        legalTargets: [],
        lastMove: null,
        promotion: null,
      });
      expect(await board.read(readMovePayloads)).toEqual([]);
      await board.apply(
        dragPiece,
        square,
        square === 'e4' || square === 'e7' ? 'e5' : 'e4'
      );
      expect(await board.read(readProbe)).toMatchObject({
        fen: oracle.fen(),
        selected: null,
        legalTargets: [],
        lastMove: null,
        promotion: null,
      });
      expect(await board.read(readBoard)).toMatchObject({
        pieces: paintedPieces(oracle),
        holding: false,
      });
      expect(await board.read(readMovePayloads)).toEqual([]);
      expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual(
        []
      );
    }
  }
);

test('all terminal response frames preserve the previously emitted mating payload and sound sequence', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  const oracle = new Chess(MATE_IN_ONE);
  const expected = payloadOf(oracle.move({ from: 'f3', to: 'f7' }));
  await board.apply(setupBoard, { fen: MATE_IN_ONE, animations: false });
  await board.apply(dragPiece, 'f3', 'f7');
  expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'capture',
    'check',
    'gameEnd',
  ]);
  for (const square of SQUARES) {
    await board.apply(selectSquare, square);
    await board.apply(
      dragPiece,
      square,
      square === 'f7' || square === 'g8' ? 'f6' : 'f7'
    );
    expect(await board.read(readMovePayloads)).toEqual([expected]);
    expect(await board.read(readProbe)).toMatchObject({
      fen: oracle.fen(),
      selected: null,
      legalTargets: [],
      status: 'checkmate',
    });
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
    expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'capture',
      'check',
      'gameEnd',
    ]);
  }
});

test.each(REFUSAL_INPUTS)(
  '$name has no callback payload and retains the entire canonical position',
  async (entry) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const input = entry.position;
    const oracle = new Chess(input.fen);
    expect(
      oracle.moves({ square: input.from, verbose: true }).map((move) => move.to)
    ).not.toContain(input.to);
    await board.apply(setupBoard, { fen: input.fen, animations: false });
    if (entry.gesture === 'drag')
      await board.apply(dragPiece, input.from, input.to);
    else
      await board.apply(
        movePiece,
        input.from,
        input.to,
        entry.gesture === 'keyboard'
      );
    expect(await board.read(readMovePayloads)).toEqual([]);
    expect((await board.read(readProbe)).fen).toBe(oracle.fen());
    expect((await board.read(readBoard)).pieces).toEqual(paintedPieces(oracle));
    expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'illegal',
    ]);
    expect(await board.read(readMovePayloads)).toEqual([]);
  }
);

const ABANDONED_FRAMES = [
  { name: 'own square', xRatio: 4.5 / 8, yRatio: 6.5 / 8 },
  { name: 'legacy right edge', xRatio: 1.3, yRatio: 0.5 },
  { name: 'legacy top edge', xRatio: 0.5, yRatio: -0.4 },
  { name: 'left edge', xRatio: -0.4, yRatio: 0.5 },
  { name: 'bottom edge', xRatio: 0.5, yRatio: 1.3 },
];
test.each(ABANDONED_FRAMES)(
  'abandoning the $name frame has no callback or canonical position effect',
  async (at) => {
    await using board = await boardSystem.run({ seed: 424242 });
    const oracle = new Chess(START);
    await board.apply(setupBoard, { fen: START, animations: false });
    await board.apply(beginDrag, 'e2');
    await board.apply(dropHeldPieceAtRatio, { source: 'e2', ...at });
    expect(await board.read(readMovePayloads)).toEqual([]);
    expect((await board.read(readProbe)).fen).toBe(oracle.fen());
    expect(await board.read(readBoard)).toMatchObject({
      pieces: paintedPieces(oracle),
      holding: false,
    });
    expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual(
      []
    );
  }
);
