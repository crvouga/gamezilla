import { describe, expect, test } from 'bun:test';
import {
  fenConsistencyError,
  isSamePosition,
  parseFen,
  positionPartOf,
  START_FEN,
  serializeFen,
  sideToMoveOf,
} from '@pkgs/chess-rules-shared/fen';

function errorField(fen: string): string | null {
  const result = parseFen(fen);
  return result.ok ? null : result.error.field;
}

describe('parseFen / serializeFen', () => {
  test('round-trips the start position with all six fields', () => {
    const result = parseFen(START_FEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).toEqual({
      placement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      sideToMove: 'w',
      castling: 'KQkq',
      enPassant: '-',
      halfmoveClock: 0,
      fullmoveNumber: 1,
    });
    expect(serializeFen(result.fields)).toBe(START_FEN);
  });

  test('names the broken field', () => {
    expect(errorField('8/8/8 w - - 0 1')).toBe('placement');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')
    ).toBe('fieldCount');
    expect(
      errorField('rnbqkbnr/ppppxppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    ).toBe('placement');
    expect(
      errorField('rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    ).toBe('placement');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1')
    ).toBe('sideToMove');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w QKkq - 0 1')
    ).toBe('castling');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1')
    ).toBe('enPassant');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1')
    ).toBe('enPassant');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1')
    ).toBe('halfmoveClock');
    expect(
      errorField('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0')
    ).toBe('fullmoveNumber');
    // Structurally fine, illegal position: two white kings.
    expect(errorField('4k3/8/8/8/8/8/8/K3K3 w - - 0 1')).toBe('position');
  });

  test('error messages are specific', () => {
    const result = parseFen(
      'rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe('rank 7 covers 7 files, expected 8');
  });

  test('sideToMoveOf tolerates malformed input', () => {
    expect(sideToMoveOf(START_FEN)).toBe('w');
    expect(sideToMoveOf('8/8/8/8/8/8/8/8 b - - 0 1')).toBe('b');
    expect(sideToMoveOf('garbage')).toBe('w');
  });
});

describe('fenConsistencyError', () => {
  function consistency(fen: string): string | null {
    const result = parseFen(fen);
    if (!result.ok) throw new Error(`fixture FEN must parse: ${fen}`);
    return fenConsistencyError(result.fields)?.field ?? null;
  }

  test('start position and plain positions are consistent', () => {
    expect(consistency(START_FEN)).toBeNull();
    expect(consistency('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toBeNull();
    expect(consistency('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1')).toBeNull();
  });

  test('a castling right without its rook or king is inconsistent', () => {
    expect(consistency('r3k2r/8/8/8/8/8/8/R3K1R1 w K - 0 1')).toBe('castling');
    expect(consistency('r3k2r/8/8/8/8/8/8/1R2K2R w Q - 0 1')).toBe('castling');
    expect(consistency('r3k2r/8/8/8/8/8/8/R2K3R w KQ - 0 1')).toBe('castling');
    expect(consistency('r4rk1/8/8/8/8/8/8/R3K2R w KQkq - 0 1')).toBe(
      'castling'
    );
  });

  test('an en-passant square needs the double-pushed pawn behind it', () => {
    expect(consistency('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')).toBeNull();
    expect(consistency('4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 1')).toBeNull();
    expect(consistency('4k3/8/8/4P3/8/8/8/4K3 w - d6 0 1')).toBe('enPassant');
    expect(consistency('4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 1')).toBe(
      'enPassant'
    );
  });
});

describe('same position', () => {
  test('fields 1–4 decide; move clocks do not', () => {
    expect(positionPartOf(START_FEN)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    );
    expect(isSamePosition(START_FEN, START_FEN.replace(' 0 1', ' 7 42'))).toBe(
      true
    );
    expect(isSamePosition(START_FEN, START_FEN.replace(' w ', ' b '))).toBe(
      false
    );
    expect(isSamePosition(START_FEN, START_FEN.replace('KQkq', 'Kkq'))).toBe(
      false
    );
  });
});
