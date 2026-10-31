import {
  pawnMoves,
  type Quoridor,
  type QuoridorWallRefusal,
  quoridorCellName,
  quoridorWall,
  wallRefusal,
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
  reason: QuoridorWallRefusal | null
): string {
  if (reason === null) return t`Legal wall. Choose this anchor to place it.`;
  const messages: Readonly<Record<QuoridorWallRefusal, string>> = {
    outside: t`Walls must fit between four squares. Choose an anchor from a1 to h8.`,
    overlap: t`This wall overlaps another wall. Choose a different anchor.`,
    crossing: t`This wall crosses another wall. Choose a different anchor or orientation.`,
    'no-walls': t`You have no walls left. Move your pawn, or choose Pass turn when no move is available.`,
    'blocks-path': t`This wall would close a player's last path to the goal. Choose another anchor.`,
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
      outlined: hill,
    };
  return {
    glyph: hill ? '◎' : legal ? '·' : '',
    tone: 'open',
    label: hill ? t`Central hill` : t`Empty`,
    outlined: hill,
  };
}

function anchorEnabled(
  cell: number,
  tool: QuoridorTool,
  legalMove: boolean
): boolean {
  return tool === 'move' ? legalMove : cell % 9 < 8 && Math.floor(cell / 9) < 8;
}

export function quoridorBoardCells(
  game: Quoridor,
  tool: QuoridorTool,
  interactive: boolean,
  preview: string | null
): readonly CellGridCell[] {
  const legal = pawnMoves(game);
  const previewWall =
    preview !== null && quoridorWall(preview) !== null ? preview : null;
  const refused =
    previewWall !== null && wallRefusal(game, previewWall) !== null;
  return Array.from({ length: 81 }, (_, index) => {
    const cell = (8 - Math.floor(index / 9)) * 9 + (index % 9);
    const id = quoridorCellName(cell);
    const move = legal.includes(cell);
    const moving = move && tool === 'move';
    const identity = cellIdentity(game, cell, moving);
    const edges = edgesAt(game.walls, cell);
    const previewEdges =
      previewWall === null || tool === 'move'
        ? []
        : edgesAt([previewWall], cell);
    return {
      ...identity,
      id,
      label: `${id}: ${identity.label}${moving ? t`, legal move` : ''}${edges.length > 0 ? t`, wall boundaries: ${edges.join(', ')}` : ''}`,
      emphasis:
        previewEdges.length > 0 && refused
          ? 'refused'
          : moving
            ? 'preview'
            : 'none',
      enabled:
        interactive && game.winner === null && anchorEnabled(cell, tool, move),
      edges,
      previewEdges,
    };
  });
}
