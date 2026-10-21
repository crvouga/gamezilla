import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  readBoard,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import type { Side } from '@pkgs/chess-board-root-harness-ts/interaction-fixtures';
import { readCompletedFeedback } from '@pkgs/chess-board-root-harness-ts/interaction-reads';
import { readFirstKeyboardSquare } from '@pkgs/chess-board-root-harness-ts/keyboard-model';
import {
  focusOtherActivityControl,
  prepareArrivingMate,
  prepareClosedOptimisticBoard,
  readOtherActivityFocus,
} from '@pkgs/chess-board-root-harness-ts/opening-actions';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given("Alice's keyboard is on another activity's control", (w) =>
  w.apply(focusOtherActivityControl)
);
Given(
  "Alice's activity has closed its chessboard after the unconfirmed move from e2 to e4 with e7 selected",
  (w) => w.apply(prepareClosedOptimisticBoard)
);
When("Alice's activity starts a chessboard facing {word}", (w, side: Side) =>
  w.apply(setupBoard, { orientation: side === 'White' ? 'white' : 'black' })
);
Then("Alice's first keyboard square is {word}", async (w, square: string) =>
  expect(await w.read(readFirstKeyboardSquare)).toBe(square)
);
Then(
  "Alice cannot have her keyboard taken from the other activity's control by opening the chessboard",
  async (w) =>
    expect(await w.read(readOtherActivityFocus)).toEqual({
      present: true,
      focused: true,
    })
);
Given(
  'Alice has just checkmated Black by moving the queen from g6 to g7 while the piece is arriving',
  async (w) => {
    await w.apply(prepareArrivingMate);
    const board = await w.read(readBoard);
    expect(board.active).toBeGreaterThan(0);
    expect(board.sounds).toEqual(['move']);
  }
);
Then(
  'Alice has heard one move sound and cannot hear its delayed check sound',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'move',
    ])
);
