import type { PlacedLetter } from './word-tiles-action';
import {
  bonusSquareAt,
  CENTER_CELL,
  cellAt,
  cellColumn,
  cellRow,
  letterMultiplier,
  neighbours,
  wordMultiplier,
} from './word-tiles-board';
import { RULESET } from './word-tiles-ruleset';
import { letterPoints } from './word-tiles-tiles';

/**
 * One complete placement judged against the committed board: its geometry,
 * every word it forms or extends, and their scores. Pure and lexicon-free —
 * whether the words are in the word list is the authority's separate check
 * (`unknownWords`), so replaying an accepted action never re-judges a word.
 * The one implementation behind the authority, client previews, bots and
 * puzzle checks.
 */

export type PlacementRefusal =
  | 'no tiles'
  | 'cell taken'
  | 'not in one line'
  | 'gap in the word'
  | 'not connected'
  | 'must cover the centre'
  | 'too short';

export type Direction = 'across' | 'down';

export type ScoredWord = {
  /** Upper-case letters, a blank as the letter it plays. */
  readonly word: string;
  readonly cells: readonly number[];
  readonly direction: Direction;
  /** Letter points after letter bonus squares under newly placed tiles. */
  readonly letters: number;
  /** Product of the word bonus squares under newly placed tiles. */
  readonly multiplier: number;
  readonly points: number;
};

export type PlacementScore = {
  readonly words: readonly ScoredWord[];
  /** The seven-tile bonus, when the placement used seven tiles. */
  readonly bonus: number;
  readonly total: number;
};

export type Evaluation =
  | {
      readonly ok: true;
      readonly score: PlacementScore;
      /** The board with the placement committed. */
      readonly board: string;
    }
  | { readonly ok: false; readonly refusal: PlacementRefusal };

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  across: [0, 1],
  down: [1, 0],
};

export function isOccupied(board: string, cell: number): boolean {
  return board[cell] !== '.';
}

export function boardIsEmpty(board: string): boolean {
  return !/[A-Za-z]/.test(board);
}

/** The maximal run of occupied cells through `cell` along `direction`. */
export function wordCells(
  board: string,
  cell: number,
  direction: Direction
): readonly number[] {
  const [dr, dc] = STEP[direction];
  const at = (n: number): number | null => {
    const c = cellAt(cellRow(cell) + dr * n, cellColumn(cell) + dc * n);
    return c !== null && isOccupied(board, c) ? c : null;
  };
  let start = 0;
  while (at(start - 1) !== null) start--;
  const cells: number[] = [];
  for (let n = start; at(n) !== null; n++) cells.push(at(n)!);
  return cells;
}

function lineOf(placed: readonly PlacedLetter[]): Direction | null {
  const rows = new Set(placed.map((p) => cellRow(p.cell)));
  const columns = new Set(placed.map((p) => cellColumn(p.cell)));
  if (rows.size === 1) return 'across';
  return columns.size === 1 ? 'down' : null;
}

function withPlaced(board: string, placed: readonly PlacedLetter[]): string {
  const cells = board.split('');
  for (const p of placed)
    cells[p.cell] = p.blank ? p.letter.toLowerCase() : p.letter;
  return cells.join('');
}

function spanIsContiguous(
  board: string,
  placed: readonly PlacedLetter[],
  direction: Direction
): boolean {
  const run = wordCells(board, placed[0]!.cell, direction);
  return placed.every((p) => run.includes(p.cell));
}

function scoreWord(
  board: string,
  cells: readonly number[],
  direction: Direction,
  fresh: ReadonlySet<number>
): ScoredWord {
  let letters = 0;
  let multiplier = 1;
  let word = '';
  for (const cell of cells) {
    const shown = board[cell]!;
    const letter = shown.toUpperCase();
    // A blank shows lower-case and is worth nothing, wherever it lies.
    const value = shown === letter ? letterPoints(letter) : 0;
    const square = fresh.has(cell) ? bonusSquareAt(cell) : null;
    letters += value * letterMultiplier(square);
    multiplier *= wordMultiplier(square);
    word += letter;
  }
  return {
    word,
    cells,
    direction,
    letters,
    multiplier,
    points: letters * multiplier,
  };
}

/** Every distinct word the placement forms or extends, each span once. */
function formedWords(
  board: string,
  placed: readonly PlacedLetter[],
  line: Direction
): readonly (readonly [readonly number[], Direction])[] {
  const cross: Direction = line === 'across' ? 'down' : 'across';
  const spans: (readonly [readonly number[], Direction])[] = [];
  const directions: readonly Direction[] =
    placed.length === 1 ? ['across', 'down'] : [line];
  for (const direction of directions) {
    const cells = wordCells(board, placed[0]!.cell, direction);
    if (cells.length >= 2) spans.push([cells, direction]);
  }
  if (placed.length > 1)
    for (const p of placed) {
      const cells = wordCells(board, p.cell, cross);
      if (cells.length >= 2) spans.push([cells, cross]);
    }
  return spans;
}

function geometryRefusal(
  board: string,
  placed: readonly PlacedLetter[]
): PlacementRefusal | null {
  if (placed.length === 0) return 'no tiles';
  if (placed.some((p) => isOccupied(board, p.cell))) return 'cell taken';
  const line = lineOf(placed);
  if (line === null) return 'not in one line';
  const next = withPlaced(board, placed);
  if (!spanIsContiguous(next, placed, line)) return 'gap in the word';
  if (boardIsEmpty(board)) {
    if (!placed.some((p) => p.cell === CENTER_CELL))
      return 'must cover the centre';
    return placed.length < 2 ? 'too short' : null;
  }
  const touches = placed.some((p) =>
    neighbours(p.cell).some((n) => isOccupied(board, n))
  );
  return touches ? null : 'not connected';
}

/** Judge one complete placement on `board`. */
export function evaluatePlacement(
  board: string,
  placed: readonly PlacedLetter[]
): Evaluation {
  const refusal = geometryRefusal(board, placed);
  if (refusal !== null) return { ok: false, refusal };
  const line = lineOf(placed)!;
  const next = withPlaced(board, placed);
  const fresh = new Set(placed.map((p) => p.cell));
  const words = formedWords(next, placed, line).map(([cells, direction]) =>
    scoreWord(next, cells, direction, fresh)
  );
  if (words.length === 0) return { ok: false, refusal: 'too short' };
  const bonus = placed.length === RULESET.rackSize ? RULESET.sevenTileBonus : 0;
  const total = words.reduce((sum, w) => sum + w.points, 0) + bonus;
  return { ok: true, board: next, score: { words, bonus, total } };
}

/** The formed words the lexicon does not hold, each once, in order formed. */
export function unknownWords(
  score: PlacementScore,
  has: (word: string) => boolean
): readonly string[] {
  return [...new Set(score.words.map((w) => w.word))].filter((w) => !has(w));
}
