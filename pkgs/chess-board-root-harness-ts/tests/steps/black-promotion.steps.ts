import { expect } from 'bun:test';
import { prepareBlackPromotion } from '@pkgs/chess-board-root-harness-ts/black-promotion-setup';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import type {
  PromotionName,
  Side,
} from '@pkgs/chess-board-root-harness-ts/interaction-fixtures';
import {
  readActivityMoves,
  readAnnouncement,
  readCompletedFeedback,
  readInteraction,
  readPiece,
} from '@pkgs/chess-board-root-harness-ts/interaction-reads';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, Then } = stepsFor<Run<BoardWorld>>();
Given(
  "Alice has a chessboard facing {word} with Black's pawn on a2 ready to promote and White's knight on b1",
  (w, side: Side) => w.apply(prepareBlackPromotion, { side })
);
Given(
  "Alice has a chessboard facing Black with Black's pawn on a2 ready to promote and interactivity disabled",
  (w) => w.apply(prepareBlackPromotion, { side: 'Black', disabled: true })
);
Given(
  "Alice has a chessboard facing {word} with Black's promotion from a2 to a1 pending and White's knight on b1",
  (w, side: Side) => w.apply(prepareBlackPromotion, { side, pending: 'a1' })
);
Given(
  "Alice has a chessboard facing {word} with Black's capture-promotion from a2 to b1 pending against White's knight",
  (w, side: Side) => w.apply(prepareBlackPromotion, { side, pending: 'b1' })
);
Then('Alice sees no White knight on b1', async (w) =>
  expect(await w.read(readPiece, 'b1')).not.toEqual({
    side: 'White',
    piece: 'knight',
  })
);
Then(
  "Alice's activity receives one capture move promoting to a {word}",
  async (w, piece: PromotionName) => {
    const moves = await w.read(readActivityMoves);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      from: 'a2',
      to: 'b1',
      captured: 'knight',
      promotion: piece,
    });
  }
);
Then("Alice's move announcement identifies a drawn position", async (w) => {
  expect((await w.read(readInteraction)).status).toBe('draw');
  expect((await w.read(readAnnouncement)).toLowerCase()).toContain('draw');
});
Then(
  'Alice hears one end sound after capture and promotion feedback',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'capture',
      'promote',
      'gameEnd',
    ])
);
Then(
  'Alice is not told a dead-position draw because the position still permits checkmate',
  async (w) => {
    expect((await w.read(readInteraction)).status).toBe('playing');
    expect((await w.read(readAnnouncement)).toLowerCase()).not.toContain(
      'draw'
    );
  }
);
Then('Alice hears no end sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).not.toContain(
    'gameEnd'
  )
);
