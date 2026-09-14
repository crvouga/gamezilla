import { isPieceBlind } from '@pkgs/chess-board/blindfold';
import { describe, expect, test } from 'vitest';

describe('isPieceBlind', () => {
  test('modes', () => {
    expect(isPieceBlind('off', 'w')).toBe(false);
    expect(isPieceBlind('full', 'b')).toBe(true);
    expect(isPieceBlind('white', 'w')).toBe(true);
    expect(isPieceBlind('white', 'b')).toBe(false);
    expect(isPieceBlind('black', 'b')).toBe(true);
  });
});
