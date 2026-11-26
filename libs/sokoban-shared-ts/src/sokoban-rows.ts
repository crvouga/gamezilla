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

export const UNREADABLE: SokobanIssue = {
  code: 'invalid_board',
  message:
    'This board cannot be read. Open a saved revision or build the board again.',
};
export const TOO_LARGE: SokobanIssue = {
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

export function boardFromRows(
  rows: readonly string[]
): Validation<SokobanBoard> {
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
