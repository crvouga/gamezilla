import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-root-harness/board-world';
import {
  readActivityMoves,
  readInteraction,
  readPromotionChoices,
} from '@pkgs/chess-board-root-harness/interaction-reads';
import { readPromotionAccess } from '@pkgs/chess-board-root-harness/promotion-access';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-root-shared/run-types';

const { Then } = stepsFor<Run<BoardWorld>>();
Then(
  'Alice can identify queen, rook, bishop and knight as the promotion choices without sound',
  async (w) => {
    expect(
      (await w.read(readPromotionAccess)).names.map((name) =>
        name.toLowerCase()
      )
    ).toEqual(['queen', 'rook', 'bishop', 'knight']);
  }
);
Then("Alice's keyboard is on the queen promotion choice", async (w) =>
  expect((await w.read(readPromotionAccess)).focusedControl).toBe(
    'example-board-promotion-q'
  )
);
Then("Alice's keyboard is on {word}", async (w, square: string) =>
  expect((await w.read(readPromotionAccess)).focusedSquare).toBe(square)
);
Then(
  'Alice cannot request promotion while interactivity is disabled',
  async (w) => {
    expect(await w.read(readInteraction)).toMatchObject({
      interactive: false,
      promotion: null,
    });
    expect(await w.read(readPromotionChoices)).toEqual([]);
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
Then(
  'Alice is not offered a promotion choice before requesting the last-rank move',
  async (w) => {
    expect(await w.read(readPromotionChoices)).toEqual([]);
    expect((await w.read(readInteraction)).promotion).toBeNull();
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
