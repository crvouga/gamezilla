import { z } from 'zod';
import {
  readSokobanNotation,
  SOKOBAN_DEFINITION_TEXT_LIMIT,
} from './sokoban-notation';
import {
  boardFromRows,
  sokobanBoardRows,
  TOO_LARGE,
  UNREADABLE,
} from './sokoban-rows';
import {
  refuse,
  SOKOBAN_MAX_SIZE,
  SOKOBAN_MIN_SIZE,
  type SokobanBoard,
  type SokobanIssue,
  type Validation,
} from './sokoban-types';

export { SOKOBAN_DEFINITION_TEXT_LIMIT } from './sokoban-notation';
export { sokobanBoardRows } from './sokoban-rows';

const definitionSchema = z
  .object({
    format: z.literal(1),
    rows: z.array(z.string()).min(SOKOBAN_MIN_SIZE).max(SOKOBAN_MAX_SIZE),
  })
  .strict();

/** The durable canonical definition text: `{"format":1,"rows":[...]}`. */
export function encodeSokobanBoard(board: SokobanBoard): string {
  if (board.squares.length !== board.width * board.height)
    throw new Error('A board has one square per column and row');
  return JSON.stringify({ format: 1, rows: sokobanBoardRows(board) });
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
 * and goals. Accepts classic SK1 or a previously saved canonical JSON board.
 */
export function decodeSokobanBoard(text: unknown): Validation<SokobanBoard> {
  if (typeof text !== 'string') return { valid: false, issues: [UNREADABLE] };
  if (text.length > SOKOBAN_DEFINITION_TEXT_LIMIT)
    return { valid: false, issues: [TOO_LARGE] };
  if (text.startsWith('SK')) {
    const parsed = readSokobanNotation(text);
    if (!parsed.valid) return parsed;
    if (parsed.value.extensions.length > 0)
      return refuse(
        'unsupported_extension',
        `This board needs ${parsed.value.extensions.map(([key]) => key).join(', ')}. Choose a classic Sokoban board to play.`
      );
    return { valid: true, value: parsed.value.board };
  }
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
