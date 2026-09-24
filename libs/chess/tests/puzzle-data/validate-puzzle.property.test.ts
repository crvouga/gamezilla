import { describe, expect, test } from 'bun:test';
import { validateLichessPuzzleRow } from '@libs/chess/public/puzzle-data';
import { partitionPuzzleBatch } from '@libs/chess/root/server/seed-chess-puzzles/puzzle-ingest';
import { puzzleTableRowOf } from '@libs/chess/root/server/seed-chess-puzzles/row';
import { START_FEN, sideToMoveOf } from '@pkgs/chess-rules/fen';
import { legalMovesOf, playUci } from '@pkgs/chess-rules/moves';
import { assertProperty } from '@pkgs/property';
import { Chess } from 'chess.js';
import fc from 'fast-check';

/** Fixed seed: the property runs are deterministic simulations (spec §0.1). */
const SEED = 20260919;

/** Plays `picks` from `fen` (index modulo the legal moves); stops at mate. */
function walk(
  fen: string,
  picks: readonly number[]
): { fen: string; line: string[] } {
  const chess = new Chess(fen);
  const line: string[] = [];
  for (const pick of picks) {
    const moves = legalMovesOf(chess);
    const move = moves[pick % Math.max(1, moves.length)];
    if (move === undefined) break;
    if (playUci(chess, move.uci) === null) {
      throw new Error(`kernel rejected its own move ${move.uci}`);
    }
    line.push(move.uci);
  }
  return { fen: chess.fen(), line };
}

function row(id: string, fen: string, moves: readonly string[]) {
  return {
    PuzzleId: id,
    FEN: fen,
    Moves: moves.join(' '),
    Rating: '1500',
    RatingDeviation: '80',
    Popularity: '50',
    NbPlays: '10',
    Themes: 'short',
    GameUrl: '',
    OpeningTags: '',
  };
}

const arbPicks = (min: number, max: number) =>
  fc.array(fc.nat(), { minLength: min, maxLength: max });

describe('validation pass over random legal lines (seeded DST)', () => {
  test('even legal lines validate; solver = inverted side to move; odd lines are rejected', () => {
    assertProperty(
      'even legal lines validate; solver = inverted side to move; odd lines are rejected',
      fc.property(arbPicks(0, 30), arbPicks(2, 9), (prefix, linePicks) => {
        const start = walk(START_FEN, prefix).fen;
        const { line } = walk(start, linePicks);
        const result = validateLichessPuzzleRow(row('r', start, line));
        if (line.length < 2) {
          expect(result.ok).toBe(false);
          return;
        }
        if (line.length % 2 === 1) {
          expect(!result.ok && result.reason).toBe('oddLength');
          const trimmed = validateLichessPuzzleRow(
            row('r', start, line.slice(0, -1))
          );
          expect(trimmed.ok || trimmed.reason === 'tooShort').toBe(true);
          return;
        }
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.puzzle.moves).toEqual(line);
        expect(result.puzzle.solverColor).toBe(
          sideToMoveOf(start) === 'w' ? 'b' : 'w'
        );
        // Invariant: the stored line always ends on a solver move.
        expect(result.puzzle.moves.length % 2).toBe(0);
      }),
      { seed: SEED, numRuns: 100 }
    );
  }, 120_000);

  test('a batch never lands two rows with one id or one position key', () => {
    assertProperty(
      'a batch never lands two rows with one id or one position key',
      fc.property(
        fc.array(fc.tuple(fc.nat(3), arbPicks(0, 6)), { maxLength: 12 }),
        (specs) => {
          const rows = specs.flatMap(([idPick, picks], index) => {
            const start = walk(START_FEN, picks).fen;
            const { line } = walk(start, [0, 1]);
            const result = validateLichessPuzzleRow(
              row(`id${index % (idPick + 1)}`, start, line)
            );
            return result.ok ? [puzzleTableRowOf(result.puzzle)] : [];
          });
          const split = partitionPuzzleBatch(rows, []);
          const ids = split.novel.map((r) => r.id);
          const keys = split.novel.map((r) => r.position_key);
          expect(new Set(ids).size).toBe(ids.length);
          expect(new Set(keys).size).toBe(keys.length);
          expect(
            split.novel.length + split.duplicateId + split.duplicatePosition
          ).toBe(rows.length);
        }
      ),
      { seed: SEED, numRuns: 60 }
    );
  }, 120_000);
});
