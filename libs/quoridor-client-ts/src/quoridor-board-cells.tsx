import {
  pawnMoves,
  type Quoridor,
  type QuoridorWallRefusal,
  quoridorCellName,
  quoridorWall,
} from '@libs/quoridor-shared-ts/quoridor';
import { t } from '@lingui/core/macro';
import type {
  CellGridCell,
  CellGridEdge,
} from '@pkgs/ui-root-client-ts/cell-grid-board';

export type QuoridorTool = 'move' | 'h' | 'v';
const IDENTITIES = ['one', 'two', 'three', 'four'] as const;
/** Each pawn's mark, by player. */
export const PAWN_GLYPHS = ['●', '◆', '▲', '■'] as const;

export function quoridorPlayerName(game: Quoridor, player: number): string {
  if (player === 0) return t`South red circle`;
  if (player === 1)
    return game.mode === 'classic'
      ? t`North gold diamond`
      : t`West gold diamond`;
  return player === 2 ? t`North green triangle` : t`East black square`;
}

export function quoridorWallMessage(
  reason: QuoridorWallRefusal | null,
  mode: Quoridor['mode'] = 'hill'
): string {
  if (reason === 'no-walls' && mode === 'classic')
    return t`You have no walls left. Move your pawn.`;
  if (reason === null) return t`Preview only. Place wall to confirm.`;
  const messages: Readonly<Record<QuoridorWallRefusal, string>> = {
    outside: t`Walls must fit between four squares. Choose a starting square from a1 to h8.`,
    overlap: t`This wall overlaps another wall. Choose a different starting square.`,
    crossing: t`This wall crosses another wall. Choose a different starting square or orientation.`,
    'no-walls': t`You have no walls left. Move your pawn, or choose Pass turn when no move is available.`,
    'blocks-path': t`This wall would close a player's last path to the goal. Choose another starting square.`,
    finished: t`This game has finished. Choose a rematch to play again.`,
  };
  return messages[reason];
}

function wallEdge(wall: string, cell: number): CellGridEdge | null {
  const horizontal = wall[2] === 'h';
  const wx = wall.charCodeAt(0) - 97;
  const wy = Number(wall[1]) - 1;
  const cross = horizontal ? cell % 9 : Math.floor(cell / 9);
  const anchor = horizontal ? wx : wy;
  if (cross !== anchor && cross !== anchor + 1) return null;
  const along = horizontal ? Math.floor(cell / 9) : cell % 9;
  const line = horizontal ? wy : wx;
  if (along === line) return horizontal ? 'top' : 'right';
  if (along === line + 1) return horizontal ? 'bottom' : 'left';
  return null;
}

function edgesAt(
  walls: readonly string[],
  cell: number
): readonly CellGridEdge[] {
  return walls.flatMap((wall) => {
    const edge = wallEdge(wall, cell);
    return edge === null ? [] : [edge];
  });
}

function cellIdentity(
  game: Quoridor,
  cell: number,
  legal: boolean
): Pick<CellGridCell, 'glyph' | 'tone' | 'identity' | 'outlined' | 'label'> {
  const player = game.pawns.indexOf(cell);
  const hill = game.mode === 'hill' && cell === 40;
  if (player >= 0)
    return {
      glyph: PAWN_GLYPHS[player] ?? '',
      tone: 'occupied',
      identity: IDENTITIES[player],
      label: quoridorPlayerName(game, player),
      outlined: false,
    };
  return {
    glyph: hill ? '★' : legal ? '○' : '',
    tone: 'open',
    label: hill ? t`Central hill` : t`Empty`,
    outlined: false,
  };
}

function anchorEnabled(
  cell: number,
  tool: QuoridorTool,
  legalMove: boolean
): boolean {
  return tool === 'move' ? legalMove : cell % 9 < 8 && Math.floor(cell / 9) < 8;
}

/** A finished game keeps showing the winner's goal instead of the next turn's. */
function isGoal(game: Quoridor, cell: number): boolean {
  const player = game.winner ?? game.turn;
  return game.mode === 'hill'
    ? cell === 40
    : Math.floor(cell / 9) === (player === 0 ? 8 : 0);
}

export function quoridorBoardCells(
  game: Quoridor,
  tool: QuoridorTool,
  interactive: boolean
): readonly CellGridCell[] {
  const legal = pawnMoves(game);
  const goalName = game.mode === 'hill' ? t`, center goal` : t`, goal edge`;
  return Array.from({ length: 81 }, (_, index) => {
    const cell = (8 - Math.floor(index / 9)) * 9 + (index % 9);
    const id = quoridorCellName(cell);
    const move = legal.includes(cell);
    // Only a player who may act sees destinations; watchers and finished games do not.
    const moving =
      move && tool === 'move' && interactive && game.winner === null;
    const identity = cellIdentity(game, cell, moving);
    const goal = isGoal(game, cell);
    const edges = edgesAt(game.walls, cell);
    return {
      ...identity,
      id,
      goal,
      label: `${id}: ${identity.label}${goal ? goalName : ''}${moving ? t`, legal move` : ''}${edges.length > 0 ? t`, wall boundaries: ${edges.join(', ')}` : ''}`,
      emphasis: moving ? 'preview' : 'none',
      enabled:
        interactive && game.winner === null && anchorEnabled(cell, tool, move),
      edges,
      previewEdges: [],
    };
  });
}

/** A wall touches four squares. Keep the rest of the position intact on hover. */
export function withWallPreview(
  cells: readonly CellGridCell[],
  action: string | null,
  refused: boolean
): readonly CellGridCell[] {
  const wall = action === null ? null : quoridorWall(action);
  if (!wall) return cells;
  const next = [...cells];
  const anchor = (8 - wall.y) * 9 + wall.x;
  const horizontal = wall.direction === 'h';
  for (const offset of [0, 1, -9, -8]) {
    const index = anchor + offset;
    const cell = cells[index]!;
    const edge = horizontal
      ? offset < 0 ? 'bottom' : 'top'
      : offset === 1 || offset === -8 ? 'left' : 'right';
    if (!cell.edges?.includes(edge))
      next[index] = {
        ...cell,
        previewEdges: [edge],
        emphasis: refused ? 'refused' : 'none',
      };
  }
  return next;
}

/** Name the anchor edge; the board previews the complete two-square wall. */
export function quoridorBoundary(action: string): string {
  const anchor = action.slice(0, 2);
  return action[2] === 'h'
    ? t`Wall starts above ${anchor}`
    : t`Wall starts to the right of ${anchor}`;
}
