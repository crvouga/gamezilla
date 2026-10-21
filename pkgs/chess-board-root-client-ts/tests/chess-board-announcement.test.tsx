/** @jsxImportSource solid-js */
/** What a screen-reader user hears after a move played on the board. */

import { afterEach, describe, expect, test } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import type { MountedBoard } from './board-fixture';
import { mountBoard } from './board-fixture';

let mounted: MountedBoard | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

/** Clicks `from` then `to` on a board showing `fen`; returns what is spoken. */
function spokenAfter(fen: string, from: Square, to: Square): string {
  const board = mountBoard({ fen, autoPromoteQueen: true });
  mounted = board;
  for (const square of [from, to]) {
    board.down({ square });
    board.up({ square });
  }
  expect(board.moves).toEqual([`${from}${to}`]);
  return board.host.querySelector('[role="status"]')?.textContent ?? '';
}

describe('spoken last move', () => {
  test('a quiet move names the piece that moved', () => {
    expect(spokenAfter('7k/8/8/8/8/8/4P3/K7 w - - 0 1', 'e2', 'e4')).toBe(
      'Pawn to e4'
    );
  });

  // regression: chess-board-promotion-announced-as-promoted-piece
  test('a promotion is a pawn move, not a move by the piece it became', () => {
    expect(spokenAfter('8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a7', 'a8')).toBe(
      'Pawn to a8, promotes to Queen'
    );
  });

  test('a capturing promotion with check', () => {
    expect(spokenAfter('1n5k/P7/8/8/8/8/8/K7 w - - 0 1', 'a7', 'b8')).toBe(
      'Pawn takes b8, promotes to Queen, check'
    );
  });
});
