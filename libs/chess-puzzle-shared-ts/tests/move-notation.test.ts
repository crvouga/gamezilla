import { describe, expect, test } from 'bun:test';
import {
  chessMoveNotationOf,
  chessMoveNumber,
  DEFAULT_CHESS_MOVE_NOTATION,
  formatSanNotation,
  isChessMoveNotation,
} from '@libs/chess-puzzle-shared-ts/chess-puzzle-notation';

describe('§7 figurine notation', () => {
  test('SAN is the default and passes strings through untouched', () => {
    expect(DEFAULT_CHESS_MOVE_NOTATION).toBe('san');
    for (const san of ['Nf3', 'exd5', 'O-O', 'Qxh7#', 'e8=Q+']) {
      expect(formatSanNotation(san, 'san')).toBe(san);
    }
  });

  test('figurine swaps the piece letter for its glyph', () => {
    expect(formatSanNotation('Nf3', 'figurine')).toBe('♘f3');
    expect(formatSanNotation('Qxh7#', 'figurine')).toBe('♕xh7#');
    expect(formatSanNotation('Rad1', 'figurine')).toBe('♖ad1');
    expect(formatSanNotation('Bb5+', 'figurine')).toBe('♗b5+');
    expect(formatSanNotation('Kg1', 'figurine')).toBe('♔g1');
  });

  test('pawn moves and castling have no piece letter to swap', () => {
    expect(formatSanNotation('e4', 'figurine')).toBe('e4');
    expect(formatSanNotation('exd5', 'figurine')).toBe('exd5');
    expect(formatSanNotation('O-O', 'figurine')).toBe('O-O');
    expect(formatSanNotation('O-O-O+', 'figurine')).toBe('O-O-O+');
  });

  test('promotions take the promoted piece glyph', () => {
    expect(formatSanNotation('e8=Q+', 'figurine')).toBe('e8=♕+');
    expect(formatSanNotation('bxa1=N', 'figurine')).toBe('bxa1=♘');
  });

  test('an empty SAN stays empty', () => {
    expect(formatSanNotation('', 'figurine')).toBe('');
  });

  test('only the two known notations are accepted', () => {
    expect(isChessMoveNotation('san')).toBe(true);
    expect(isChessMoveNotation('figurine')).toBe(true);
    expect(isChessMoveNotation('fan')).toBe(false);
    expect(isChessMoveNotation(undefined)).toBe(false);
  });
});

describe('chess reads any stored notation it does not offer as SAN', () => {
  test('the platform default, a legacy row and an unknown key all read as SAN', () => {
    for (const stored of ['', 'hieroglyphs', 'not a key'])
      expect(chessMoveNotationOf(stored)).toBe('san');
    expect(chessMoveNotationOf('figurine')).toBe('figurine');
  });

  test('chess numbers a move as its position says', () => {
    expect(chessMoveNumber('8/8/8/8/8/8/8/K6k w - - 0 32', 0)).toBe('32.');
    expect(chessMoveNumber('8/8/8/8/8/8/8/K6k b - - 0 32', 0)).toBe('32...');
    expect(chessMoveNumber('8/8/8/8/8/8/8/K6k b - - 0 32', 1)).toBeNull();
  });
});
