import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  closeBoard,
  configureBoard,
  movePiece,
  readBoard,
  replacePosition,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import {
  finishEarlierAnimation,
  readCurrentArrivals,
  readEarlierCompletion,
} from '@pkgs/chess-board-root-harness-ts/lifecycle-actions';
import { readLifecycle } from '@pkgs/chess-board-root-harness-ts/lifecycle-reads';
import { clearBoardEvidence } from '@pkgs/chess-board-root-harness-ts/options-actions';
import {
  CAPTURE,
  REPLACEMENT,
} from '@pkgs/chess-board-root-harness-ts/positions';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();

Given(
  "Alice's capture from e4 to d5 was interrupted by turning the chessboard",
  async (w) => {
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.apply(movePiece, 'e4', 'd5');
    await w.apply(configureBoard, { orientation: 'black' });
    expect(await w.read(readEarlierCompletion)).toBe(true);
  }
);
Given("Alice's activity has supplied the replacement position", (w) =>
  w.apply(replacePosition, REPLACEMENT)
);
Given(
  "Alice's earlier capture from e4 to d5 was interrupted by a replacement",
  async (w) => {
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.apply(movePiece, 'e4', 'd5');
    await w.apply(replacePosition, REPLACEMENT);
    expect(await w.read(readEarlierCompletion)).toBe(true);
  }
);
Given(
  "Alice's capture from e4 to d5 was interrupted by closing the chessboard",
  async (w) => {
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.apply(movePiece, 'e4', 'd5');
    await w.apply(closeBoard);
    await w.apply(clearBoardEvidence);
    expect(await w.read(readEarlierCompletion)).toBe(true);
  }
);
Given(
  "Alice's activity has started another chessboard at the normal opening",
  (w) => w.apply(setupBoard, {})
);
When("Alice's earlier interrupted arrival finishes", (w) =>
  w.apply(finishEarlierAnimation)
);
Then('Alice sees the current capture still animating', async (w) =>
  expect(await w.read(readCurrentArrivals)).toContainEqual({
    piece: 'wp',
    square: 'd5',
  })
);
Then('Alice sees its capture remnant', async (w) =>
  expect((await w.read(readBoard)).ghost).toBe(true)
);
Then('Alice cannot see the chessboard because it is closed', async (w) =>
  expect((await w.read(readLifecycle)).board).toMatchObject({
    present: false,
    position: -1,
    displayedPosition: -1,
  })
);
