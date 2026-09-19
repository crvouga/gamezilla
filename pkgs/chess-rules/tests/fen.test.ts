import { describe, expect, test } from 'bun:test';
import {
  parseFen,
  START_FEN,
  serializeFen,
  sideToMoveOf,
} from '@pkgs/chess-rules/fen';

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
