import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { confirmOfferedPosition } from '@pkgs/chess-board-root-harness-ts/authority-actions';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  beginDrag,
  cancelDrag,
  closeBoard,
  configureBoard,
  finishAnimation,
  leaveActivity,
  movePiece,
  readBoard,
  readProbe,
  readSlides,
  readSquare,
  reduceMotion,
  replacePosition,
  selectSquare,
  setupBoard,
  setVisibility,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import { readEarlierCompletion } from '@pkgs/chess-board-root-harness-ts/lifecycle-actions';
import {
  CAPTURE,
  INITIAL,
  REPLACEMENT,
} from '@pkgs/chess-board-root-harness-ts/positions';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

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
Given("Alice's capture from e4 to d5 is animating( again)", async (w) => {
  const retained = await w.read(readEarlierCompletion);
  // The capture starts from a settled position: a replacement position
  // slides its own pieces, and they have arrived before Alice moves.
  await w.apply(replacePosition, CAPTURE);
  await w.apply(finishAnimation);
  await w.apply(movePiece, 'e4', 'd5');
  expect((await w.read(readBoard)).active).toBeGreaterThan(0);
  expect(await w.read(readEarlierCompletion)).toBe(retained);
});
Given("Alice's move from g1 to f3 is animating", async (w) => {
  await w.apply(setupBoard, {});
  await w.apply(movePiece, 'g1', 'f3');
});
Given(
  'Alice has a hidden chessboard after capturing from e4 to d5',
  async (w) => {
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.apply(movePiece, 'e4', 'd5');
    await w.apply(setVisibility, false);
  }
);
Given('Alice has chessboard sound enabled', (w) =>
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
When(
  "Alice's activity replaces that position with the position before White's first move",
  (w) => w.apply(replacePosition, INITIAL)
);
When("Alice's activity supplies the same position again", (w) =>
  w.apply(confirmOfferedPosition)
);
When('Alice changes the orientation', async (w) => {
  const current = await w.read(readProbe);
  await w.apply(configureBoard, {
    orientation: current.orientation === 'white' ? 'black' : 'white',
  });
});
When('Alice resizes the chessboard', (w) =>
  w.apply(configureBoard, { size: 512 })
);
When('Alice closes the chessboard', (w) => w.apply(closeBoard));
When('Alice cancels the drag', (w) => w.apply(cancelDrag));
When("Alice switches away from the chessboard's activity", (w) =>
  w.apply(leaveActivity)
);
When("Alice's chessboard becomes visible", (w) => w.apply(setVisibility, true));
When('Alice waits for the animation to finish', (w) =>
  w.apply(finishAnimation)
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
Then("Alice's chessboard faces {word}", async (w, side: string) =>
  expect((await w.read(readProbe)).orientation === side.toLowerCase()).toBe(
    true
  )
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
Then('Alice sees the pawn slide from e4 to e2', async (w) => {
  // The one slide the replacement asked for: no other piece changed square.
  const slides = await w.read(readSlides);
  expect(slides.filter((slide) => slide.includes('>e2@'))).toEqual([
    'wp:e4>e2@150',
  ]);
  expect(slides.at(-1)).toBe('wp:e4>e2@150');
});
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
