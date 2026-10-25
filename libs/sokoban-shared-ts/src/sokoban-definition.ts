import { z } from 'zod';
import {
  type Cell,
  isStandable,
  refuse,
  SOKOBAN_MAX_SIZE,
  SOKOBAN_MIN_SIZE,
  type SokobanBoard,
  type SokobanIssue,
  type SokobanSquare,
  squareAt,
  type Validation,
} from './sokoban-types';

/** Text longer than this is refused before it is parsed. */
export const SOKOBAN_DEFINITION_TEXT_LIMIT = 65_536;

type Glyph = {
  readonly square: SokobanSquare;
  readonly piece: 'worker' | 'crate' | null;
};

const GLYPHS: Readonly<Record<string, Glyph>> = {
  '#': { square: 'wall', piece: null },
  ' ': { square: 'floor', piece: null },
  '.': { square: 'goal', piece: null },
  '~': { square: 'outside', piece: null },
  '@': { square: 'floor', piece: 'worker' },
  '+': { square: 'goal', piece: 'worker' },
  $: { square: 'floor', piece: 'crate' },
  '*': { square: 'goal', piece: 'crate' },
};

const TERRAIN_CHARS: Readonly<Record<SokobanSquare, string>> = {
  wall: '#',
  floor: ' ',
  goal: '.',
  outside: '~',
};

const definitionSchema = z
  .object({
    format: z.literal(1),
    rows: z.array(z.string()).min(SOKOBAN_MIN_SIZE).max(SOKOBAN_MAX_SIZE),
  })
  .strict();

const UNREADABLE: SokobanIssue = {
  code: 'invalid_board',
  message:
    'This board cannot be read. Open a saved revision or build the board again.',
};
const TOO_LARGE: SokobanIssue = {
  code: 'board_too_large',
  message: 'A board has at most 20 columns and 20 rows.',
};

function pieceChar(square: SokobanSquare, piece: 'worker' | 'crate'): string {
  if (!isStandable(square))
    throw new Error('A piece stands only on floor or a goal');
  if (piece === 'worker') return square === 'goal' ? '+' : '@';
  return square === 'goal' ? '*' : '$';
}

/** One string per row; throws when a piece is off the board or off its footing. */
export function sokobanBoardRows(board: SokobanBoard): string[] {
  const grid = board.squares.map((square) => TERRAIN_CHARS[square]);
  const place = (cell: Cell, piece: 'worker' | 'crate'): void => {
    const square = squareAt(board, cell);
    const index = cell.y * board.width + cell.x;
    if (square === null || grid[index] !== TERRAIN_CHARS[square])
      throw new Error('Pieces stand on separate squares of the board');
    grid[index] = pieceChar(square, piece);
  };
  if (board.worker !== null) place(board.worker, 'worker');
  for (const crate of board.crates) place(crate, 'crate');
  return Array.from({ length: board.height }, (_, y) =>
    grid.slice(y * board.width, (y + 1) * board.width).join('')
  );
}

/** The durable canonical definition text: `{"format":1,"rows":[...]}`. */
export function encodeSokobanBoard(board: SokobanBoard): string {
  if (board.squares.length !== board.width * board.height)
    throw new Error('A board has one square per column and row');
  return JSON.stringify({ format: 1, rows: sokobanBoardRows(board) });
}

function boardFromRows(rows: readonly string[]): Validation<SokobanBoard> {
  const width = rows[0]?.length ?? 0;
  if (width > SOKOBAN_MAX_SIZE) return { valid: false, issues: [TOO_LARGE] };
  if (width < SOKOBAN_MIN_SIZE || rows.some((row) => row.length !== width))
    return { valid: false, issues: [UNREADABLE] };
  const squares: SokobanSquare[] = [];
  const crates: Cell[] = [];
  const workers: Cell[] = [];
  for (const [y, row] of rows.entries())
    for (const [x, char] of [...row].entries()) {
      const glyph = GLYPHS[char];
      if (glyph === undefined) return { valid: false, issues: [UNREADABLE] };
      squares.push(glyph.square);
      if (glyph.piece === 'worker') workers.push({ x, y });
      if (glyph.piece === 'crate') crates.push({ x, y });
    }
  if (workers.length > 1)
    return refuse(
      'several_workers',
      'A board has one worker. Remove the extra workers.'
    );
  return {
    valid: true,
    value: {
      width,
      height: rows.length,
      squares,
      worker: workers[0] ?? null,
      crates,
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Draft-tolerant: a board may lack its worker and have any number of crates
 * and goals. Only the canonical encoding is accepted, so a board has exactly
 * one definition text.
 */
export function decodeSokobanBoard(text: unknown): Validation<SokobanBoard> {
  if (typeof text !== 'string') return { valid: false, issues: [UNREADABLE] };
  if (text.length > SOKOBAN_DEFINITION_TEXT_LIMIT)
    return { valid: false, issues: [TOO_LARGE] };
  const input = parseJson(text);
  const rowCount =
    typeof input === 'object' &&
    input !== null &&
    'rows' in input &&
    Array.isArray(input.rows)
      ? input.rows.length
      : 0;
  if (rowCount > SOKOBAN_MAX_SIZE) return { valid: false, issues: [TOO_LARGE] };
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: [UNREADABLE] };
  const board = boardFromRows(parsed.data.rows);
  if (!board.valid) return board;
  return encodeSokobanBoard(board.value) === text
    ? board
    : { valid: false, issues: [UNREADABLE] };
}

export function sokobanGoalCount(board: SokobanBoard): number {
  let goals = 0;
  for (const square of board.squares) if (square === 'goal') goals += 1;
  return goals;
}

/** What must be fixed before a board can be playtested, in plain English. */
export function sokobanCorrections(board: SokobanBoard): SokobanIssue[] {
  const issues: SokobanIssue[] = [];
  if (board.worker === null)
    issues.push({
      code: 'needs_worker',
      message: 'Place the worker on the board.',
    });
  if (board.crates.length === 0)
    issues.push({ code: 'needs_crate', message: 'Place at least one crate.' });
  if (board.crates.length !== sokobanGoalCount(board))
    issues.push({
      code: 'crate_goal_mismatch',
      message: 'Use as many crates as goals.',
    });
  return issues;
}

/** A playable board: readable and with nothing to correct. */
export function validateSokobanDefinition(
  text: unknown
): Validation<SokobanBoard> {
  const board = decodeSokobanBoard(text);
  if (!board.valid) return board;
  const issues = sokobanCorrections(board.value);
  return issues.length === 0 ? board : { valid: false, issues };
}
