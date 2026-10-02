import { expect } from 'bun:test';
import {
  type BoardWorld,
  beginDrag,
  CAPTURE,
  closeBoard,
  configureBoard,
  INITIAL,
  movePiece,
  REPLACEMENT,
  readBoard,
  readProbe,
  readSlides,
  readSquare,
  reduceMotion,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board/harness';
import type { Square } from '@pkgs/chess-board-core/types';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given('Alice has an interactive chessboard', (w) => w.apply(setupBoard, {}));
Given('Alice has a silent chessboard', (w) =>
  w.apply(setupBoard, { sound: false })
);
Given('Alice has a chessboard with interactivity disabled', (w) =>
  w.apply(setupBoard, { interactive: false })
);
Given('Alice has a chessboard ready for a capture', (w) =>
  w.apply(setupBoard, { fen: CAPTURE })
);
Given('Alice has a silent chessboard ready for a capture', (w) =>
  w.apply(setupBoard, { fen: CAPTURE, sound: false })
);
Given('Alice is dragging the piece on e2', async (w) => {
  await w.apply(setupBoard, {});
  await w.apply(beginDrag, 'e2');
});
Given('Alice has selected the piece on e2', async (w) => {
  await w.apply(setupBoard, {});
  await w.apply(selectSquare, 'e2');
});
Given("Alice's capture from e4 to d5 is animating", async (w) => {
  await w.apply(setupBoard, { fen: CAPTURE });
  await w.apply(movePiece, 'e4', 'd5');
});
Given("Alice's move from g1 to f3 is animating", async (w) => {
  await w.apply(setupBoard, {});
  await w.apply(movePiece, 'g1', 'f3');
});
Given("Alice's board settings enable sound", (w) =>
  w.apply(configureBoard, { sound: true })
);
When(
  'Alice moves the piece from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(movePiece, from, to)
);
When(
  'Alice moves the piece from {word} to {word} with the keyboard',
  (w, from: Square, to: Square) => w.apply(movePiece, from, to, true)
);
When('Alice selects the piece on {word}', (w, square: Square) =>
  w.apply(selectSquare, square)
);
When("Alice's board settings disable interactivity", (w) =>
  w.apply(configureBoard, { interactive: false })
);
When("Alice's board settings disable sound", (w) =>
  w.apply(configureBoard, { sound: false })
);
When("Alice's board settings enable reduced motion", (w) =>
  w.apply(reduceMotion, true)
);
When("Alice's activity replaces the position", (w) =>
  w.apply(configureBoard, { fen: REPLACEMENT })
);
When("Alice's activity supplies the same position again", (w) =>
  w.apply(configureBoard, { fen: INITIAL, fenSyncKey: 1 })
);
When('Alice changes the orientation', (w) =>
  w.apply(configureBoard, { orientation: 'black' })
);
When('Alice resizes the chessboard', (w) =>
  w.apply(configureBoard, { size: 512 })
);
When('Alice closes the chessboard', (w) => w.apply(closeBoard));
Then('Alice sees a White pawn on {word}', async (w, square: Square) =>
  expect((await w.read(readBoard)).pieces).toContain(`wp@${square}`)
);
Then(
  'Alice sees the White pawn remaining on {word}',
  async (w, square: Square) =>
    expect((await w.read(readBoard)).pieces).toContain(`wp@${square}`)
);
Then('Alice still sees a White knight on f3', async (w) =>
  expect((await w.read(readBoard)).pieces).toContain('wn@f3')
);
Then("Alice's activity receives one move", async (w) =>
  expect((await w.read(readBoard)).moves).toHaveLength(1)
);
Then("Alice's activity receives no moves", async (w) =>
  expect((await w.read(readBoard)).moves).toEqual([])
);
Then('Alice no longer holds a piece', async (w) =>
  expect((await w.read(readBoard)).holding).toBe(false)
);
Then('Alice sees the replacement position', async (w) =>
  expect((await w.read(readProbe)).fen).toBe(REPLACEMENT)
);
Then('Alice still has e2 selected', async (w) =>
  expect((await w.read(readProbe)).selected).toBe('e2')
);
Then("Alice's chessboard faces Black", async (w) =>
  expect((await w.read(readProbe)).orientation).toBe('black')
);
Then('Alice hears one move sound', async (w) => {
  await w.advanceTime(1000);
  expect((await w.read(readBoard)).sounds).toEqual(['move']);
});
Then('Alice hears no chessboard sounds', async (w) => {
  await w.advanceTime(1000);
  expect((await w.read(readBoard)).sounds).toEqual([]);
});
Then('Alice sees no captured piece after the animation', async (w) => {
  await w.advanceTime(1000);
  expect((await w.read(readBoard)).ghost).toBe(false);
});
Then('Alice sees no capture remnant', async (w) =>
  expect((await w.read(readBoard)).ghost).toBe(false)
);
Then('Alice sees no unfinished animation', async (w) =>
  expect((await w.read(readBoard)).active).toBe(0)
);
Then('Alice sees the knight slide from g1 to f3', async (w) =>
  expect(await w.read(readSlides)).toEqual(['wn:g1>f3@150'])
);
Then('Alice can identify the White pawn on e2 without sound', async (w) =>
  expect((await w.read(readSquare, 'e2')).label).toContain('White pawn')
);
Then('Alice can identify e2 as selected without sound', async (w) =>
  expect((await w.read(readSquare, 'e2')).selected).toBe('true')
);
Then('Alice can identify e4 as a legal destination without sound', async (w) =>
  expect((await w.read(readSquare, 'e4')).description).toContain(
    'Legal destination'
  )
);
Then('Alice can identify e4 as empty without sound', async (w) =>
  expect((await w.read(readSquare, 'e4')).label).toContain('empty')
);
