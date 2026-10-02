import './parameter-types';
import { expect } from 'bun:test';
import {
  type BoardWorld,
  dragPiece,
  dropHeldPiece,
  dropHeldPieceOutside,
  PINNED_KNIGHT,
  type PieceName,
  ROOK_CHECK,
  readActivityMoves,
  readBoard,
  readInteraction,
  readPiece,
  readProbe,
  type Side,
} from '@pkgs/chess-board/harness';
import type { Square } from '@pkgs/chess-board-core/types';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { When, Then } = stepsFor<Run<BoardWorld>>();
When(
  'Alice drags the piece from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(dragPiece, from, to)
);
When('Alice drops the held piece on {word}', (w, to: Square) =>
  w.apply(dropHeldPiece, to)
);
When('Alice drops the held piece outside the chessboard', (w) =>
  w.apply(dropHeldPieceOutside)
);
Then('Alice (still )has {word} selected', async (w, square: Square) =>
  expect((await w.read(readInteraction)).selected).toBe(square)
);
Then('Alice sees {word} as a legal destination', async (w, square: Square) =>
  expect((await w.read(readInteraction)).legalDestinations).toContain(square)
);
Then(
  'Alice sees only {word} and {word} as legal destinations',
  async (w, first: Square, second: Square) =>
    expect((await w.read(readInteraction)).legalDestinations).toEqual([
      first,
      second,
    ])
);
Then(
  'Alice sees only {word} as a legal destination',
  async (w, square: Square) =>
    expect((await w.read(readInteraction)).legalDestinations).toEqual([square])
);
Then('Alice sees no selection or legal destinations', async (w) =>
  expect(await w.read(readInteraction)).toMatchObject({
    selected: null,
    legalDestinations: [],
  })
);
Then('Alice sees {word} to move', async (w, side: Side) =>
  expect((await w.read(readInteraction)).sideToMove).toBe(side)
);
Then(
  'Alice sees {word} and {word} marked as the last move',
  async (w, from: Square, to: Square) => {
    const view = await w.read(readInteraction);
    expect(view.lastMove).toEqual({ from, to });
    expect(view.lastMoveMarks).toEqual(
      [`last-move@${from}`, `last-move@${to}`].sort()
    );
  }
);

Then(
  'Alice cannot select {word} while White is to move',
  async (w, square: Square) => {
    expect(await w.read(readInteraction)).toMatchObject({
      sideToMove: 'White',
      selected: null,
    });
    expect(await w.read(readPiece, square)).toMatchObject({ side: 'Black' });
  }
);
Then(
  'Alice cannot select the empty square {word}',
  async (w, square: Square) => {
    expect(await w.read(readPiece, square)).toBeNull();
    expect((await w.read(readInteraction)).selected).toBeNull();
  }
);
Then(
  'Alice is not offered a legal destination for the knight on e2 because it is pinned to its king',
  async (w) =>
    expect(await w.read(readInteraction)).toMatchObject({
      selected: 'e2',
      legalDestinations: [],
    })
);
Then(
  "Alice cannot move {word}'s pawn while {word} is to move",
  async (w, _movingSide: Side, sideToMove: Side) => {
    expect((await w.read(readInteraction)).sideToMove).toBe(sideToMove);
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
Then('Alice cannot capture the White pawn on d2', async (w) => {
  expect(await w.read(readPiece, 'd2')).toEqual({
    side: 'White',
    piece: 'pawn',
  });
  expect(await w.read(readActivityMoves)).toEqual([]);
});
Then('Alice cannot move a piece from the empty square e4', async (w) => {
  expect(await w.read(readPiece, 'e4')).toBeNull();
  expect((await w.read(readBoard)).moves).toEqual([]);
});
Then(
  "Alice cannot move White's pawn from e2 to the illegal destination e5",
  async (w) => {
    expect(await w.read(readPiece, 'e2')).toEqual({
      side: 'White',
      piece: 'pawn',
    });
    expect(await w.read(readPiece, 'e5')).toBeNull();
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
Then(
  'Alice is not offered another move because Black is checkmated',
  async (w) =>
    expect(await w.read(readInteraction)).toMatchObject({
      status: 'checkmate',
      sideToMove: 'Black',
      legalDestinations: [],
    })
);
Then(
  'Alice is not offered another move because Black is stalemated',
  async (w) =>
    expect(await w.read(readInteraction)).toMatchObject({
      status: 'stalemate',
      sideToMove: 'Black',
      legalDestinations: [],
    })
);

Then(
  'Alice cannot move the rook because its king would remain in check',
  async (w) => {
    expect((await w.read(readProbe)).fen).toBe(ROOK_CHECK);
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);
Then(
  'Alice cannot move the pinned knight because it would expose its king',
  async (w) => {
    expect((await w.read(readProbe)).fen).toBe(PINNED_KNIGHT);
    expect(await w.read(readActivityMoves)).toEqual([]);
  }
);

Then(
  'Alice (still )sees a/the {chessSide} {chessPiece} (remaining )on {word}',
  async (w, side: Side, piece: PieceName, square: Square) =>
    expect(await w.read(readPiece, square)).toEqual({ side, piece })
);
