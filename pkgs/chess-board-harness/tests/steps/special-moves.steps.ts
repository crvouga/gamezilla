import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { setupBoard } from '@pkgs/chess-board-harness/chess-board';
import {
  cancelPromotion,
  choosePromotion,
  setupPendingPromotion,
} from '@pkgs/chess-board-harness/interaction-actions';
import type {
  PromotionName,
  Side,
} from '@pkgs/chess-board-harness/interaction-fixtures';
import {
  CASTLE_ACROSS_CHECK,
  castlingConfig,
  EN_PASSANT,
  EXPIRED_EN_PASSANT,
  WHITE_PROMOTION,
} from '@pkgs/chess-board-harness/interaction-fixtures';
import {
  readActivityMoves,
  readAnnouncement,
  readInteraction,
  readPiece,
  readPromotionChoices,
} from '@pkgs/chess-board-harness/interaction-reads';
import { pressBoardKey } from '@pkgs/chess-board-harness/options-actions';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given(
  'Alice has a chessboard ready for {word} {word} castling',
  (w, side: Side, _direction: string) =>
    w.apply(setupBoard, castlingConfig(side))
);
Given('Alice has a silent chessboard ready for White kingside castling', (w) =>
  w.apply(setupBoard, { ...castlingConfig('White'), sound: false })
);
Given(
  "Alice has a chessboard where White's kingside castling crosses check",
  (w) => w.apply(setupBoard, { fen: CASTLE_ACROSS_CHECK })
);
Given(
  'Alice has a chessboard ready for White to capture en passant from e5 to d6',
  (w) => w.apply(setupBoard, { fen: EN_PASSANT })
);
Given(
  'Alice has a silent chessboard ready for White to capture en passant from e5 to d6',
  (w) => w.apply(setupBoard, { fen: EN_PASSANT, sound: false })
);
Given(
  "Alice has a chessboard where White's en passant opportunity from e5 to d6 has expired",
  (w) => w.apply(setupBoard, { fen: EXPIRED_EN_PASSANT })
);
Given("Alice has a chessboard ready for White's promotion from a7 to a8", (w) =>
  w.apply(setupBoard, { fen: WHITE_PROMOTION })
);
Given(
  "Alice has a chessboard ready for White's promotion from a7 to a8 with automatic queen promotion enabled",
  (w) => w.apply(setupBoard, { fen: WHITE_PROMOTION, autoPromoteQueen: true })
);
Given('Alice has a pending White promotion from a7 to a8', async (w) => {
  await w.apply(setupPendingPromotion);
  expect((await w.read(readInteraction)).promotion).toEqual({
    from: 'a7',
    to: 'a8',
    color: 'w',
  });
});
Given(
  'Alice has a chessboard facing Black with a pending Black capture-promotion from b2 to a1',
  async (w) => {
    await w.apply(setupPendingPromotion, true);
    expect((await w.read(readInteraction)).promotion).toEqual({
      from: 'b2',
      to: 'a1',
      color: 'b',
    });
  }
);
When('Alice chooses the promotion to a {word}', (w, choice: PromotionName) =>
  w.apply(choosePromotion, choice)
);
When('Alice cancels the promotion', (w) => w.apply(cancelPromotion));
When('Alice cancels the promotion with Escape', (w) =>
  w.apply(pressBoardKey, 'Escape')
);
Then(
  'Alice sees {word} castled {word} with the king on {word} and rook on {word}',
  async (w, ...args: [Side, string, Square, Square]) => {
    const [side, direction, king, rook] = args;
    expect(await w.read(readPiece, king)).toEqual({ side, piece: 'king' });
    expect(await w.read(readPiece, rook)).toEqual({ side, piece: 'rook' });
    expect(await w.read(readActivityMoves)).toMatchObject([
      { castling: direction },
    ]);
  }
);
Then(
  'Alice is told {word} castled {word}',
  async (w, _side: Side, direction: string) =>
    expect(await w.read(readAnnouncement)).toBe(`King castles ${direction}`)
);
Then('Alice cannot castle kingside across check', async (w) => {
  expect((await w.read(readInteraction)).lastMove).toBeNull();
  expect(await w.read(readActivityMoves)).toEqual([]);
});
Then('Alice sees no Black pawn on d5', async (w) =>
  expect(await w.read(readPiece, 'd5')).not.toEqual({
    side: 'Black',
    piece: 'pawn',
  })
);
Then(
  'Alice cannot capture en passant after its opportunity has expired',
  async (w) => expect(await w.read(readActivityMoves)).toEqual([])
);
Then(
  'Alice is (still )offered queen, rook, bishop and knight as the promotion choice',
  async (w) =>
    expect(await w.read(readPromotionChoices)).toEqual([
      'queen',
      'rook',
      'bishop',
      'knight',
    ])
);
Then('Alice is not offered a promotion choice', async (w) => {
  expect(await w.read(readPromotionChoices)).toEqual([]);
  expect((await w.read(readInteraction)).promotion).toBeNull();
});

Then(
  "Alice's activity receives one move promoting to a {word}",
  async (w, choice: PromotionName) => {
    const moves = await w.read(readActivityMoves);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ promotion: choice });
  }
);
Then(
  'Alice cannot move the rook on h1 until the promotion choice is decided or cancelled',
  async (w) => {
    expect(await w.read(readPiece, 'h1')).toEqual({
      side: 'White',
      piece: 'rook',
    });
    expect(await w.read(readPromotionChoices)).toEqual([
      'queen',
      'rook',
      'bishop',
      'knight',
    ]);
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
Given("Alice has cancelled White's promotion from a7 to a8", async (w) => {
  await w.apply(setupPendingPromotion);
  await w.apply(cancelPromotion);
  expect((await w.read(readInteraction)).promotion).toBeNull();
});
