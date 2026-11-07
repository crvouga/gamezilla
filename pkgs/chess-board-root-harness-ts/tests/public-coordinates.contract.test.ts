import { expect, test } from 'bun:test';
import {
  boardSystem,
  configureBoard,
  movePiece,
  readProbe,
  readSlides,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import { readOptions } from '@pkgs/chess-board-root-harness-ts/options-reads';

// regression: chess-puzzle-public-board-composition
test('public coordinates preserve the puzzle frame and still motion across wide layout and orientation changes', async () => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, {
    showCoordinates: true,
    coordinatePlacement: 'outside-start',
    animations: false,
  });
  expect((await board.read(readOptions)).frame).toEqual({
    edge: 'start',
    labels: [
      ['8', '7', '6', '5', '4', '3', '2', '1'],
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    ],
  });
  await board.apply(movePiece, 'e2', 'e4');
  const position = (await board.read(readProbe)).fen;
  await board.apply(configureBoard, {
    coordinatePlacement: 'outside-end',
    orientation: 'black',
  });
  expect((await board.read(readOptions)).frame).toEqual({
    edge: 'end',
    labels: [
      ['1', '2', '3', '4', '5', '6', '7', '8'],
      ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'],
    ],
  });
  expect((await board.read(readProbe)).fen).toBe(position);
  expect(await board.read(readSlides)).toEqual([]);
});

test.each([
  { showCoordinates: true },
  { showCoordinates: true, coordinatePlacement: 'inside' as const },
  { showCoordinates: false, coordinatePlacement: 'outside-end' as const },
])('only enabled outside coordinates add a frame: %j', async (config) => {
  await using board = await boardSystem.run({ seed: 424242 });
  await board.apply(setupBoard, config);
  expect((await board.read(readOptions)).frame).toBeNull();
});
