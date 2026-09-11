import { describe, expect, test } from 'vitest';
import { isPieceBlind } from '@pkgs/chess-board/blindfold';

describe('isPieceBlind', () => {
  test('modes', () => {
    expect(isPieceBlind('off', 'w')).toBe(false);
    expect(isPieceBlind('full', 'b')).toBe(true);
    expect(isPieceBlind('white', 'w')).toBe(true);
    expect(isPieceBlind('white', 'b')).toBe(false);
    expect(isPieceBlind('black', 'b')).toBe(true);
  });
});
