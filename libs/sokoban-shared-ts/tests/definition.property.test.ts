import { expect, test } from 'bun:test';
import {
  decodeSokobanBoard,
  encodeSokobanBoard,
  SOKOBAN_DEFINITION_TEXT_LIMIT,
  sokobanBoardRows,
  sokobanCorrections,
  validateSokobanDefinition,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  parseSquareName,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { boardOf, draftBoardArb, rowsText } from './sokoban-fixtures';

function codes(text: string): readonly string[] {
  const result = decodeSokobanBoard(text);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
}

function correctionCodes(...rows: readonly string[]): readonly string[] {
  return sokobanCorrections(boardOf(...rows)).map((issue) => issue.code);
}

test('every draft board survives the codec and its text is canonical', () => {
  assertProperty(
    'definition round trip',
    fc.property(draftBoardArb(), (board) => {
      const text = encodeSokobanBoard(board);
      expect(decodeSokobanBoard(text)).toEqual({ valid: true, value: board });
      expect(text).toBe(rowsText(...sokobanBoardRows(board)));
    })
  );
});

test('the board decoder is total and every accepted text is its own encoding', () => {
  const glyph = fc.constantFrom('#', ' ', '.', '~', '@', '+', '$', '*', 'x');
  const rows = fc.array(fc.string({ unit: glyph, maxLength: 4 }), {
    maxLength: 4,
  });
  assertProperty(
    'untrusted definitions',
    fc.property(
      fc.oneof(
        fc.string(),
        fc.jsonValue().map((value) => JSON.stringify(value)),
        rows.map((entries) => rowsText(...entries))
      ),
      (text) => {
        const decoded = decodeSokobanBoard(text);
        if (decoded.valid) expect(encodeSokobanBoard(decoded.value)).toBe(text);
        expect(() => validateSokobanDefinition(text)).not.toThrow();
      }
    )
  );
  expect(decodeSokobanBoard(42).valid).toBe(false);
});

test('unreadable boards are refused with a reason', () => {
  expect(codes('{')).toEqual(['invalid_board']);
  expect(codes('{"format":2,"rows":["@$."]}')).toEqual(['invalid_board']);
  expect(codes(rowsText('@$x.'))).toEqual(['invalid_board']);
  expect(codes(rowsText('@$.', '##'))).toEqual(['invalid_board']);
  expect(codes(rowsText())).toEqual(['invalid_board']);
  expect(codes(rowsText(''))).toEqual(['invalid_board']);
  expect(codes(rowsText('@$.@'))).toEqual(['several_workers']);
  expect(codes('{"rows":["@$."],"format":1}')).toEqual(['invalid_board']);
  expect(codes('{ "format": 1, "rows": ["@$."] }')).toEqual(['invalid_board']);
  expect(codes('{"format":1,"rows":["@$\\u002e"]}')).toEqual(['invalid_board']);
  expect(codes('x'.repeat(SOKOBAN_DEFINITION_TEXT_LIMIT + 1))).toEqual([
    'board_too_large',
  ]);
});

test('a board has 1 to 20 columns and rows', () => {
  const full = Array.from({ length: 20 }, () => ' '.repeat(20));
  expect(decodeSokobanBoard(rowsText(...full)).valid).toBe(true);
  expect(codes(rowsText(...full, ' '.repeat(20)))).toEqual(['board_too_large']);
  expect(codes(rowsText(...full.map((row) => `${row} `)))).toEqual([
    'board_too_large',
  ]);
  expect(decodeSokobanBoard(rowsText(' ')).valid).toBe(true);
});

test('corrections list a missing worker, no crates, and unequal crates and goals', () => {
  expect(correctionCodes('@$.')).toEqual([]);
  expect(correctionCodes(' $.')).toEqual(['needs_worker']);
  expect(correctionCodes('@ .')).toEqual([
    'needs_crate',
    'crate_goal_mismatch',
  ]);
  expect(correctionCodes('@  ')).toEqual(['needs_crate']);
  expect(correctionCodes('@$.$')).toEqual(['crate_goal_mismatch']);
  expect(correctionCodes('~~~')).toEqual(['needs_worker', 'needs_crate']);
  expect(sokobanCorrections(boardOf(' $.'))).toEqual([
    { code: 'needs_worker', message: 'Place the worker on the board.' },
  ]);
  expect(sokobanCorrections(boardOf('@ .'))).toEqual([
    { code: 'needs_crate', message: 'Place at least one crate.' },
    { code: 'crate_goal_mismatch', message: 'Use as many crates as goals.' },
  ]);
  expect(validateSokobanDefinition(rowsText(' $.'))).toMatchObject({
    valid: false,
    issues: [{ code: 'needs_worker' }],
  });
  expect(validateSokobanDefinition(rowsText('@*'))).toMatchObject({
    valid: true,
  });
  // A goal under the worker still needs a crate of its own.
  expect(correctionCodes('+*')).toEqual(['crate_goal_mismatch']);
  expect(correctionCodes('+$*')).toEqual([]);
});

test('corrections agree with the worker, crate and goal counts of any draft', () => {
  assertProperty(
    'corrections',
    fc.property(draftBoardArb(), (board) => {
      const goals = board.squares.filter((square) => square === 'goal').length;
      const expected = [
        ...(board.worker === null ? ['needs_worker'] : []),
        ...(board.crates.length === 0 ? ['needs_crate'] : []),
        ...(board.crates.length === goals ? [] : ['crate_goal_mismatch']),
      ];
      expect(sokobanCorrections(board).map((issue) => issue.code)).toEqual(
        expected
      );
      expect(validateSokobanDefinition(encodeSokobanBoard(board)).valid).toBe(
        expected.length === 0
      );
    })
  );
});

test('squares are named by column letter and row number from A1 at the top-left', () => {
  expect(squareName({ x: 0, y: 0 })).toBe('A1');
  expect(squareName({ x: 19, y: 19 })).toBe('T20');
  expect(squareName({ x: 3, y: 1 })).toBe('D2');
  expect(parseSquareName('C3')).toEqual({ x: 2, y: 2 });
  for (let y = 0; y < 20; y += 1)
    for (let x = 0; x < 20; x += 1)
      expect(parseSquareName(squareName({ x, y }))).toEqual({ x, y });
  for (const name of ['U1', 'A0', 'A21', 'a1', 'A01', '', 'AA1', 'A1 '])
    expect(parseSquareName(name)).toBeNull();
  expect(() => squareName({ x: 20, y: 0 })).toThrow();
  expect(() => squareName({ x: 0, y: 20 })).toThrow();
});
