import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  readChessPuzzleFeedConfig,
} from '@libs/chess/public/chess-puzzle-feed-config';
import {
  DEFAULT_CHESS_MOVE_NOTATION,
  formatSanNotation,
  isChessMoveNotation,
} from '@libs/chess/public/chess-puzzle-notation';

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

describe('notation in the puzzle prefs row', () => {
  test('defaults to SAN letters', () => {
    expect(DEFAULT_CHESS_PUZZLE_FEED_CONFIG.notation).toBe('san');
  });

  test('a legacy row without the field still decodes', () => {
    const decoded = readChessPuzzleFeedConfig({
      mode: 'auto',
      customRating: 1500,
    });
    expect(decoded?.notation).toBe('san');
  });

  test('a stored figurine preference round-trips', () => {
    const decoded = readChessPuzzleFeedConfig({
      ...DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
      notation: 'figurine',
    });
    expect(decoded?.notation).toBe('figurine');
  });

  test('an unusable notation falls back rather than voiding the row', () => {
    const decoded = readChessPuzzleFeedConfig({
      ...DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
      notation: 'hieroglyphs',
    });
    expect(decoded?.notation).toBe('san');
  });
});
