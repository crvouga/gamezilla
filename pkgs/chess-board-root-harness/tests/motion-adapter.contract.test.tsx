import { expect, test } from 'bun:test';
import { confirmOfferedPosition } from '@pkgs/chess-board-root-harness/authority-actions';
import {
  beginDrag,
  boardSystem,
  configureBoard,
  movePiece,
  readBoard,
  readProbe,
  readSlides,
  reduceMotion,
  replacePosition,
  setupBoard,
} from '@pkgs/chess-board-root-harness/chess-board';
import {
  dragPiece,
  dropHeldPieceAtRatio,
} from '@pkgs/chess-board-root-harness/interaction-actions';
import { readCompletedFeedback } from '@pkgs/chess-board-root-harness/interaction-reads';
import { CAPTURE } from '@pkgs/chess-board-root-harness/positions';
import { Chess } from 'chess.js';

test.each([
  ['e2', 'e4', 'wp:hand>e4@90'],
  ['f1', 'f5', 'wb:hand>f1@90'],
] as const)(
  'compositor receives the actual released %s piece as its origin',
  async (from, to, request) => {
    await using board = await boardSystem.run({ seed: 424242 });
    await board.apply(dragPiece, from, to);
    expect(await board.read(readSlides)).toEqual([request]);
  }
);
test('an outside release requests only a settle back to its source', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(beginDrag, 'g1');
  await board.apply(dropHeldPieceAtRatio, {
    source: 'g1',
    xRatio: 1.4,
    yRatio: 0.5,
  });
  expect(await board.read(readSlides)).toEqual(['wn:hand>g1@90']);
});
test('the supplied reply forwards one ordinary transform and duration', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  const oracle = new Chess();
  await board.apply(dragPiece, 'e2', 'e4');
  await board.apply(confirmOfferedPosition);
  oracle.move('e4');
  oracle.move('e5');
  await board.apply(configureBoard, { fen: oracle.fen() });
  await board.apply(configureBoard, { fen: oracle.fen() });
  expect(await board.read(readSlides)).toEqual([
    'wp:hand>e4@90',
    'bp:e7>e5@150',
  ]);
});
test('idle orientation changes do not create compositor requests', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(configureBoard, { orientation: 'black' });
  await board.apply(configureBoard, { orientation: 'white' });
  expect(await board.read(readSlides)).toEqual([]);
});
test('mid-arrival refusal settles the knight without requesting a reverse slide', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  const opening = new Chess().fen();
  await board.apply(movePiece, 'g1', 'f3');
  await board.advanceTime(75);
  await board.apply(replacePosition, opening);
  expect(await board.read(readSlides)).toEqual(['wn:g1>f3@150']);
  expect((await board.read(readProbe)).fen).toBe(opening);
  expect(await board.read(readBoard)).toMatchObject({
    ghost: false,
    active: 0,
  });
});
test.each([300, 0])(
  'public duration %s forwards to the compositor without a fallback',
  async (duration) => {
    await using board = await boardSystem.run({ seed: 424242 });
    await board.apply(setupBoard, { animationDurationMs: duration });
    await board.apply(movePiece, 'g1', 'f3');
    if (duration === 0) await board.apply(dragPiece, 'e7', 'e5');
    expect(await board.read(readSlides)).toEqual(
      duration === 0 ? [] : ['wn:g1>f3@300']
    );
  }
);
test('a low-end environment preserves compositor movement', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, { motionCapabilities: { lowEnd: true } });
  await board.apply(movePiece, 'g1', 'f3');
  expect(await board.read(readSlides)).toEqual(['wn:g1>f3@150']);
});
test.each([
  { motionCapabilities: { reducedMotion: true } },
  { motionCapabilities: { webAnimations: false } },
  { animations: false },
])(
  'a non-sliding public board never leaves compositor work or victim nodes',
  async (config) => {
    await using board = await boardSystem.run({ seed: 424242 });
    await board.apply(setupBoard, { fen: CAPTURE, ...config });
    await board.apply(movePiece, 'e4', 'd5');
    expect(await board.read(readBoard)).toMatchObject({
      ghost: false,
      active: 0,
    });
    const first = await board.until(readCompletedFeedback, { maxMs: 1000 });
    expect(first).toEqual(['capture']);
    await board.apply(dragPiece, 'd8', 'd5');
    expect(await board.read(readBoard)).toMatchObject({
      ghost: false,
      active: 0,
    });
    expect(await board.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'capture',
      'capture',
    ]);
    expect(await board.read(readSlides)).toEqual([]);
    expect(await board.read(readBoard)).toMatchObject({
      ghost: false,
      active: 0,
    });
    const oracle = new Chess(CAPTURE);
    oracle.move('exd5');
    oracle.move('Qxd5');
    expect((await board.read(readProbe)).fen).toBe(oracle.fen());
  }
);
test('reduced motion cancels the actual first handle and permits a fresh later request', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(movePiece, 'g1', 'f3');
  await board.apply(reduceMotion, true);
  await board.apply(movePiece, 'g8', 'f6');
  expect((await board.read(readBoard)).active).toBe(0);
  await board.apply(reduceMotion, false);
  await board.apply(movePiece, 'b1', 'c3');
  expect(await board.read(readSlides)).toEqual([
    'wn:g1>f3@150',
    'wn:b1>c3@150',
  ]);
});
