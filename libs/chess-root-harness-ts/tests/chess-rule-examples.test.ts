import { expect, test } from 'bun:test';
import { RULE_EXAMPLE_POSITIONS } from '@libs/chess-root-client-ts/chess-rule-examples';
import { ChessGame } from '@pkgs/chess-board-core-shared-ts/game';

// regression: chess-rule-examples-show-opening — the examples' positions
// had no kings, the board refused them, and every example drew the opening
// position instead of the move its caption described.
test.each(Object.entries(RULE_EXAMPLE_POSITIONS))(
  'the %s example draws its own position',
  (_name, fen) => {
    expect(new ChessGame(fen).getSnapshot().fen).toBe(fen);
  }
);
