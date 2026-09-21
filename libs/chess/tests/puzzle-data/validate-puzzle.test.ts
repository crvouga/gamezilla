import { describe, expect, test } from 'bun:test';

import {
  type PuzzleRejectionReason,
  type PuzzleValidation,
  validateLichessPuzzleRow,
  validatePuzzleRecord,
  validateStoredPuzzleRow,
} from '@libs/chess/public/puzzle-data';

type Cells = {
  readonly id?: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating?: string;
  readonly deviation?: string;
  readonly popularity?: string;
  readonly plays?: string;
  readonly themes?: string;
};

/** A Lichess CSV record (header names as in the published database). */
function lichess(cells: Cells): Record<string, string> {
  return {
    PuzzleId: cells.id ?? 'p1',
    FEN: cells.fen,
    Moves: cells.moves,
    Rating: cells.rating ?? '1500',
    RatingDeviation: cells.deviation ?? '80',
    Popularity: cells.popularity ?? '90',
    NbPlays: cells.plays ?? '1000',
    Themes: cells.themes ?? 'mate mateIn1',
    GameUrl: 'https://lichess.org/abc#10',
    OpeningTags: '',
  };
}

function reasonOf(result: PuzzleValidation): PuzzleRejectionReason | 'ok' {
  return result.ok ? 'ok' : result.reason;
}

function check(cells: Cells): PuzzleRejectionReason | 'ok' {
  return reasonOf(validateLichessPuzzleRow(lichess(cells)));
}

/** White to move ⇒ Black solves (Lichess mate-in-1, sim fixture `007hv`). */
const BLACK_SOLVES = {
  fen: '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32',
  moves: 'd2c3 d4g1',
};
/** Black to move ⇒ White solves (sim web fixture `001KR`). */
const WHITE_SOLVES = {
  fen: '6Qk/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K b - - 0 28',
  moves: 'h8g8 f1f8',
};
const CASTLE_FEN = (rights: string) =>
  `r3k3/8/8/8/8/8/8/R3K2R b ${rights} - 0 1`;
const PROMOTION_FEN = '3r4/4P3/8/8/8/8/k7/4K3 b - - 0 1';
const EN_PASSANT_FEN = '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1';
/** After d7d5 the e5 pawn is pinned along rank 5 (king a5, rook h5). */
const PINNED_EN_PASSANT_FEN = '4k3/3p4/8/K3P2r/8/8/8/8 b - - 0 1';

describe('validateLichessPuzzleRow — accepted rows (§4 model)', () => {
  test('solver is the side NOT to move in the FEN (Black solves)', () => {
    const result = validateLichessPuzzleRow(lichess(BLACK_SOLVES));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle).toMatchObject({
      id: 'p1',
      fen: BLACK_SOLVES.fen,
      moves: ['d2c3', 'd4g1'],
      rating: 1500,
      ratingDeviation: 80,
      popularity: 90,
      plays: 1000,
      themes: ['mate', 'mateIn1'],
      openingTags: [],
      sourceGameUrl: 'https://lichess.org/abc#10',
      solverColor: 'b',
    });
    expect(result.puzzle.positionKey).toMatch(/^[0-9a-f]{16}$/);
  });

  test('solver is White when Black is to move (orientation flips)', () => {
    const result = validateLichessPuzzleRow(lichess(WHITE_SOLVES));
    expect(result.ok && result.puzzle.solverColor).toBe('w');
  });

  test('themes / opening tags are split, deduped and sorted', () => {
    const result = validateLichessPuzzleRow({
      ...lichess({ ...BLACK_SOLVES, themes: ' short mate  mate ' }),
      OpeningTags: 'Sicilian_Defense Sicilian_Defense_Najdorf',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.themes).toEqual(['mate', 'short']);
    expect(result.puzzle.openingTags).toEqual([
      'Sicilian_Defense',
      'Sicilian_Defense_Najdorf',
    ]);
  });

  test('negative popularity is valid (Lichess votes range −100…100)', () => {
    expect(check({ ...BLACK_SOLVES, popularity: '-40' })).toBe('ok');
  });

  test('castling in the line is legal when the FEN grants the right', () => {
    expect(check({ fen: CASTLE_FEN('KQq'), moves: 'a8b8 e1g1' })).toBe('ok');
  });

  test('castling written king-onto-rook is stored canonically', () => {
    const result = validateLichessPuzzleRow(
      lichess({ fen: CASTLE_FEN('KQq'), moves: 'a8b8 e1h1' })
    );
    expect(result.ok && result.puzzle.moves).toEqual(['a8b8', 'e1g1']);
  });

  test('en passant as the solution move', () => {
    expect(check({ fen: EN_PASSANT_FEN, moves: 'd7d5 e5d6' })).toBe('ok');
  });

  test('promotion, underpromotion and capture-promotion', () => {
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7e8q' })).toBe('ok');
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7e8n' })).toBe('ok');
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7d8q' })).toBe('ok');
  });
});

describe('validateLichessPuzzleRow — rejection reasons (§23)', () => {
  test('missingField: empty id, FEN or moves', () => {
    expect(check({ ...BLACK_SOLVES, id: '' })).toBe('missingField');
    expect(check({ fen: '', moves: BLACK_SOLVES.moves })).toBe('missingField');
    expect(check({ fen: BLACK_SOLVES.fen, moves: '' })).toBe('missingField');
  });

  test('invalidFen: malformed FEN', () => {
    expect(check({ fen: 'not a fen', moves: 'e2e4 e7e5' })).toBe('invalidFen');
    expect(
      check({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: 'e2e4 e7e5' })
    ).toBe('invalidFen');
  });

  test('invalidFen: castling rights in the FEN are wrong (§34)', () => {
    // `K` claimed but the h1 rook is on g1.
    expect(
      check({
        fen: 'r3k3/8/8/8/8/8/8/R3K1R1 b KQq - 0 1',
        moves: 'a8b8 e1c1',
      })
    ).toBe('invalidFen');
  });

  test('invalidFen: en-passant square without a double-pushed pawn', () => {
    expect(
      check({ fen: '4k3/8/8/4P3/8/8/8/4K3 w - d6 0 1', moves: 'e1d1 e8d8' })
    ).toBe('invalidFen');
  });

  test('illegalMove: castling whose rights are missing from the FEN (§34)', () => {
    expect(check({ fen: CASTLE_FEN('q'), moves: 'a8b8 e1g1' })).toBe(
      'illegalMove'
    );
    expect(check({ fen: CASTLE_FEN('-'), moves: 'a8b8 e1c1' })).toBe(
      'illegalMove'
    );
  });

  test('illegalMove: en passant that would expose the king (pin)', () => {
    expect(check({ fen: PINNED_EN_PASSANT_FEN, moves: 'd7d5 e5d6' })).toBe(
      'illegalMove'
    );
  });

  test('illegalMove: promotion without a piece is never guessed', () => {
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7e8' })).toBe(
      'illegalMove'
    );
  });

  test('illegalMove: the setup move belongs to the side to move', () => {
    expect(check({ fen: BLACK_SOLVES.fen, moves: 'd4g1 d2c3' })).toBe(
      'illegalMove'
    );
  });

  test('malformedMove: not UCI', () => {
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7e9' })).toBe(
      'malformedMove'
    );
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 Qe8' })).toBe(
      'malformedMove'
    );
  });

  test('tooShort: only the setup move', () => {
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3' })).toBe('tooShort');
  });

  test('oddLength: a legal line that ends on the opponent move', () => {
    expect(check({ fen: PROMOTION_FEN, moves: 'a2a3 e7e8q a3a2' })).toBe(
      'oddLength'
    );
  });

  test('invalidNumber: rating / deviation / plays must be integers ≥ 0', () => {
    expect(check({ ...BLACK_SOLVES, rating: 'abc' })).toBe('invalidNumber');
    expect(check({ ...BLACK_SOLVES, rating: '' })).toBe('invalidNumber');
    expect(check({ ...BLACK_SOLVES, deviation: '-1' })).toBe('invalidNumber');
    expect(check({ ...BLACK_SOLVES, plays: '1.5' })).toBe('invalidNumber');
  });
});

describe('position key (§23 dedupe)', () => {
  function keyOf(fen: string, moves: string, id = 'p1'): string {
    const result = validateLichessPuzzleRow(lichess({ id, fen, moves }));
    if (!result.ok) throw new Error(`fixture must validate: ${result.detail}`);
    return result.puzzle.positionKey;
  }

  test('same position + line under another id and other clocks collides', () => {
    const a = keyOf(BLACK_SOLVES.fen, BLACK_SOLVES.moves, 'a');
    const b = keyOf(
      BLACK_SOLVES.fen.replace(' 1 32', ' 0 7'),
      BLACK_SOLVES.moves,
      'b'
    );
    expect(b).toBe(a);
  });

  test('a different line or castling right is a different puzzle', () => {
    const base = keyOf(PROMOTION_FEN, 'a2a3 e7e8q');
    expect(keyOf(PROMOTION_FEN, 'a2a3 e7e8n')).not.toBe(base);
    expect(keyOf(CASTLE_FEN('KQq'), 'a8b8 e1g1')).not.toBe(
      keyOf(CASTLE_FEN('Kq'), 'a8b8 e1g1')
    );
  });
});

describe('stored / load-file rows', () => {
  const stored = {
    id: 'x1',
    fen: WHITE_SOLVES.fen,
    moves: WHITE_SOLVES.moves,
    rating: 598,
    rating_deviation: 81,
    popularity: 100,
    nb_plays: 174,
    game_url: null,
  };

  test('themes as JSON text (load file) or a decoded array (Postgres)', () => {
    for (const themes of ['["mate","mateIn1"]', ['mateIn1', 'mate']]) {
      const result = validateStoredPuzzleRow({
        ...stored,
        themes,
        opening_tags: '[]',
      });
      expect(result.ok && result.puzzle.themes).toEqual(['mate', 'mateIn1']);
      expect(result.ok && result.puzzle.solverColor).toBe('w');
    }
  });

  test('validatePuzzleRecord routes by header shape', () => {
    expect(validatePuzzleRecord(lichess(BLACK_SOLVES)).ok).toBe(true);
    expect(
      validatePuzzleRecord({ ...stored, themes: '[]', opening_tags: '[]' }).ok
    ).toBe(true);
  });
});
