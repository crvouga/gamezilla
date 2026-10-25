import { z } from 'zod';
import { sokobanCorrections } from './sokoban-definition';
import {
  type Cell,
  isStandable,
  refuse,
  SOKOBAN_DIRECTIONS,
  type SokobanBoard,
  type SokobanDirection,
  type SokobanPosition,
  sameCell,
  squareAt,
  stepCell,
  type Validation,
} from './sokoban-types';

/** An attempt is refused further moves past this many. */
export const SOKOBAN_MOVE_LIMIT = 1_000_000;
const POSITION_TEXT_LIMIT = 65_536;

/** LURD notation: one lower-case letter per move. */
export const SOKOBAN_ACTIONS: Readonly<Record<SokobanDirection, string>> = {
  up: 'u',
  down: 'd',
  left: 'l',
  right: 'r',
};

const pointSchema = z.tuple([z.number().int(), z.number().int()]);
const positionSchema = z
  .object({
    worker: pointSchema,
    crates: z.array(pointSchema).max(400),
    moves: z.number().int().min(0).max(SOKOBAN_MOVE_LIMIT),
    pushes: z.number().int().min(0).max(SOKOBAN_MOVE_LIMIT),
  })
  .strict();

const UNREADABLE_POSITION = {
  code: 'invalid_position',
  message:
    'This position cannot be read. Restart the puzzle to play it from the start.',
} as const;

export function encodeSokobanAction(direction: SokobanDirection): string {
  return SOKOBAN_ACTIONS[direction];
}

export function decodeSokobanAction(
  text: unknown
): Validation<SokobanDirection> {
  const direction = SOKOBAN_DIRECTIONS.find(
    (entry) => SOKOBAN_ACTIONS[entry] === text
  );
  return direction === undefined
    ? refuse(
        'invalid_action',
        'This move cannot be read. Move the worker up, down, left or right.'
      )
    : { valid: true, value: direction };
}

export function encodeSokobanPosition(position: SokobanPosition): string {
  return JSON.stringify({
    worker: [position.worker.x, position.worker.y],
    crates: position.crates.map((crate) => [crate.x, crate.y]),
    moves: position.moves,
    pushes: position.pushes,
  });
}

/** The board as published, with no moves and no pushes. */
export function initialSokobanPosition(
  board: SokobanBoard
): Validation<SokobanPosition> {
  const issues = sokobanCorrections(board);
  if (board.worker === null || issues.length > 0)
    return { valid: false, issues };
  return {
    valid: true,
    value: { worker: board.worker, crates: board.crates, moves: 0, pushes: 0 },
  };
}

function piecesStandApart(
  board: SokobanBoard,
  worker: Cell,
  crates: readonly Cell[]
): boolean {
  const seen = new Set<number>();
  for (const cell of [worker, ...crates]) {
    if (!isStandable(squareAt(board, cell))) return false;
    const index = cell.y * board.width + cell.x;
    if (seen.has(index)) return false;
    seen.add(index);
  }
  return true;
}

/** Checks untrusted data against the board before any of it is trusted. */
export function validateSokobanPosition(
  board: SokobanBoard,
  input: unknown
): Validation<SokobanPosition> {
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: [UNREADABLE_POSITION] };
  const { moves, pushes } = parsed.data;
  const worker = { x: parsed.data.worker[0], y: parsed.data.worker[1] };
  const crates = parsed.data.crates.map(([x, y]) => ({ x, y }));
  if (
    pushes > moves ||
    crates.length !== board.crates.length ||
    !piecesStandApart(board, worker, crates)
  )
    return { valid: false, issues: [UNREADABLE_POSITION] };
  return { valid: true, value: { worker, crates, moves, pushes } };
}

/** Total on arbitrary text: unreadable input is refused, never thrown. */
export function decodeSokobanPosition(
  board: SokobanBoard,
  text: unknown
): Validation<SokobanPosition> {
  if (typeof text !== 'string' || text.length > POSITION_TEXT_LIMIT)
    return { valid: false, issues: [UNREADABLE_POSITION] };
  try {
    return validateSokobanPosition(board, JSON.parse(text));
  } catch {
    return { valid: false, issues: [UNREADABLE_POSITION] };
  }
}

function crateIndexAt(crates: readonly Cell[], cell: Cell): number {
  return crates.findIndex((crate) => sameCell(crate, cell));
}

/**
 * One move: a step onto empty floor or a goal, or a push of the one crate in
 * front of the worker one square further. A refused move changes nothing.
 */
export function applySokobanMove(
  board: SokobanBoard,
  position: SokobanPosition,
  direction: SokobanDirection
): Validation<SokobanPosition> {
  const ahead = stepCell(position.worker, direction);
  if (!isStandable(squareAt(board, ahead)))
    return refuse('blocked', "The worker's way is blocked.");
  const pushed = crateIndexAt(position.crates, ahead);
  if (pushed !== -1) {
    const beyond = stepCell(ahead, direction);
    if (
      !isStandable(squareAt(board, beyond)) ||
      crateIndexAt(position.crates, beyond) !== -1
    )
      return refuse('crate_blocked', 'That crate cannot move.');
  }
  if (position.moves >= SOKOBAN_MOVE_LIMIT)
    return refuse(
      'move_limit',
      'This attempt has reached its move limit. Restart the puzzle to keep playing.'
    );
  return {
    valid: true,
    value: {
      worker: ahead,
      crates:
        pushed === -1
          ? position.crates
          : position.crates.map((crate, index) =>
              index === pushed ? stepCell(crate, direction) : crate
            ),
      moves: position.moves + 1,
      pushes: position.pushes + (pushed === -1 ? 0 : 1),
    },
  };
}

/** Every crate stands on a goal. */
export function sokobanComplete(
  board: SokobanBoard,
  position: SokobanPosition
): boolean {
  return position.crates.every((crate) => squareAt(board, crate) === 'goal');
}
