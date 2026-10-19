/**
 * The board shows a wrong move as chess plays it (the platform paints the
 * move it played over the reached position): the piece stands where it
 * was played, a promotion shows the piece that was chosen, and a move
 * chess refuses leaves the position as it was.
 */
import { describe, expect, test } from 'bun:test';
import { chessPuzzles } from '@libs/chess-puzzle-shared/chess-puzzles';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';

const played = (position: string, action: string): string | null =>
  chessRules.play(
    position,
    chessPuzzles.judge?.canonical?.(position, action) ?? action,
    '',
    []
  )?.position ?? null;

describe('a wrong move on the board', () => {
  const reached = '6k1/8/8/8/8/8/8/R6K w - - 0 1';

  test('stays on the square it was played to', () => {
    expect(played(reached, 'a1a5')).toBe('6k1/8/8/R7/8/8/8/7K b - - 1 1');
  });

  test('a wrong promotion shows the piece that was chosen', () => {
    expect(played('6k1/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n')).toBe(
      'N5k1/8/8/8/8/8/8/7K b - - 0 1'
    );
  });

  test('a move that does not fit the position is refused', () => {
    expect(played(reached, 'b1b5')).toBeNull();
  });
});
