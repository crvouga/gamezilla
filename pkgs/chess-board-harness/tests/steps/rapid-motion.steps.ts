import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { readActivityMoves } from '@pkgs/chess-board-harness/interaction-reads';
import {
  prepareRapidCapture,
  RAPID_CAPTURE_FINAL,
  RAPID_CAPTURE_LINE,
  readSettledMotion,
} from '@pkgs/chess-board-harness/motion-setup';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';

const { Given, Then } = stepsFor<Run<BoardWorld>>();
Given(
  'Alice has played e2-e4, d7-d5, e4-d5, d8-d5 and b1-c3 without waiting for their arrivals',
  (w) => w.apply(prepareRapidCapture)
);
Then('Alice sees the completed position after those six moves', async (w) =>
  expect(await w.until(readSettledMotion, { maxMs: 1000 })).toEqual(
    RAPID_CAPTURE_FINAL
  )
);
Then(
  "Alice's activity receives those six moves exactly once each in order",
  async (w) =>
    expect(
      (await w.read(readActivityMoves)).map((move) => [move.from, move.to])
    ).toEqual(RAPID_CAPTURE_LINE.map((move) => [...move]))
);
