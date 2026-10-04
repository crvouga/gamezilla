import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { closeBoard, configureBoard, readProbe, setupBoard } from '@pkgs/chess-board-harness/chess-board';
import { confirmOfferedPosition, refuseOfferedMove, setupMatedWhiteMove, setupOfferedWhiteMove, startUnusableBoard, supplyBlackReply, supplyUnusablePosition } from '@pkgs/chess-board-harness/authority-actions';
import { INITIAL } from '@pkgs/chess-board-harness/positions';
import { OPENING_BOARD, readOpeningBoard } from '@pkgs/chess-board-harness/opening-actions';
import { readActivityMoves, readAnnouncement, readInteraction, readPiece, readPromotionChoices } from '@pkgs/chess-board-harness/interaction-reads';
import { readPromotionAccess } from '@pkgs/chess-board-harness/promotion-access';
import { WHITE_PROMOTION } from '@pkgs/chess-board-harness/interaction-fixtures';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given(
  "Alice has a chessboard ready for White's promotion from a7 to a8 with interactivity disabled",
  (w) => w.apply(setupBoard, { fen: WHITE_PROMOTION, interactive: false })
);
Given(
  "Alice has a chessboard after White's move from e2 to e4 with e7 selected",
  async (w) => {
    await w.apply(setupOfferedWhiteMove, true);
    expect((await w.read(readInteraction)).selected).toBe('e7');
  }
);
Given(
  "Alice has a chessboard after offering White's move from e2 to e4",
  async (w) => {
    await w.apply(setupOfferedWhiteMove);
    expect(await w.read(readPiece, 'e4')).toEqual({
      side: 'White',
      piece: 'pawn',
    });
  }
);
Given("Alice's activity has no chessboard yet", (w) => w.apply(closeBoard));
When("Alice's board settings enable interactivity", (w) =>
  w.apply(configureBoard, { interactive: true })
);
When("Alice's activity confirms the offered position", (w) =>
  w.apply(confirmOfferedPosition)
);
When("Alice's activity refuses the offered move", (w) =>
  w.apply(refuseOfferedMove)
);
When("Alice's activity supplies Black's reply from e7 to e5", (w) =>
  w.apply(supplyBlackReply)
);
When("Alice's activity supplies an unusable position", (w) =>
  w.apply(supplyUnusablePosition)
);
When("Alice's activity starts a chessboard with an unusable position", (w) =>
  w.apply(startUnusableBoard)
);
When("Alice's board settings enable automatic queen promotion", (w) =>
  w.apply(configureBoard, { autoPromoteQueen: true })
);
Then('Alice can request promotion from a7 to a8', async (w) => {
  expect(await w.read(readInteraction)).toMatchObject({
    interactive: true,
    status: 'playing',
    promotion: null,
    sideToMove: 'White',
  });
  expect(await w.read(readPiece, 'a7')).toEqual({
    side: 'White',
    piece: 'pawn',
  });
  expect(await w.read(readPiece, 'a8')).toBeNull();
});
Then('Alice sees no last move marked', async (w) =>
  expect(await w.read(readInteraction)).toMatchObject({
    lastMove: null,
    lastMoveMarks: [],
  })
);
Then("Alice sees White's offered move refused", async (w) => {
  expect((await w.read(readProbe)).fen).toBe(INITIAL);
  expect(await w.read(readInteraction)).toMatchObject({
    lastMove: null,
    sideToMove: 'White',
  });
});
Then("Alice (still )sees the position before White's first move", async (w) =>
  expect(await w.read(readOpeningBoard)).toEqual(OPENING_BOARD)
);
Then(
  'Alice cannot complete the move until the pending promotion choice is decided',
  async (w) => {
    expect(await w.read(readPromotionChoices)).toEqual([
      'queen',
      'rook',
      'bishop',
      'knight',
    ]);
    expect(await w.read(readActivityMoves)).toEqual([]);
    expect(await w.read(readPiece, 'a7')).toEqual({
      side: 'White',
      piece: 'pawn',
    });
  }
);
Then("Alice's activity receives one capture move", async (w) => {
  const moves = await w.read(readActivityMoves);
  expect(moves).toHaveLength(1);
  expect(moves[0]?.captured).toBeDefined();
  expect(moves[0]?.captured).not.toBeNull();
});
Given(
  'Alice has a chessboard after White checkmated Black by moving the queen from g6 to g7',
  async (w) => {
    await w.apply(setupMatedWhiteMove);
    expect((await w.read(readInteraction)).status).toBe('checkmate');
  }
);
Then('Alice has no move announcement from the previous position', async (w) =>
  expect(await w.read(readAnnouncement)).toBe('')
);

When("Alice's board settings disable automatic queen promotion", (w) =>
  w.apply(configureBoard, { autoPromoteQueen: false })
);
Then(
  'Alice can request promotion from a7 to a8 automatically to a queen',
  async (w) => {
    expect(await w.read(readPromotionAccess)).toMatchObject({
      automaticQueen: true,
    });
    expect(await w.read(readInteraction)).toMatchObject({
      interactive: true,
      status: 'playing',
      sideToMove: 'White',
      promotion: null,
    });
    expect(await w.read(readPiece, 'a7')).toEqual({
      side: 'White',
      piece: 'pawn',
    });
    expect(await w.read(readPiece, 'a8')).toBeNull();
  }
);
Then(
  'Alice can request promotion from a7 to a8 with an explicit promotion choice',
  async (w) => {
    expect(await w.read(readPromotionAccess)).toMatchObject({
      automaticQueen: false,
    });
    expect(await w.read(readInteraction)).toMatchObject({
      interactive: true,
      status: 'playing',
      sideToMove: 'White',
      promotion: null,
    });
    expect(await w.read(readPiece, 'a7')).toEqual({
      side: 'White',
      piece: 'pawn',
    });
    expect(await w.read(readPiece, 'a8')).toBeNull();
  }
);
