import {
  BOARD_SIZE,
  bonusSquareAt,
  CELL_COUNT,
  CENTER_CELL,
  cellName,
} from '@libs/word-tiles-shared-ts/word-tiles-board';
import type { WordTilesPosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  letterPoints,
  tileOf,
  tileSymbol,
} from '@libs/word-tiles-shared-ts/word-tiles-tiles';
import { t } from '@lingui/core/macro';
import type { TileRackTile } from '@pkgs/ui-root-client-ts/tile-rack';
import type {
  WordTileBoardCell,
  WordTileSquare,
} from '@pkgs/ui-root-client-ts/word-tile-board';
import type { Candidate } from './word-tiles-candidate';

export const COLUMN_LABELS = 'abcdefghijklmno'.split('');
export const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, n) =>
  String(n + 1)
);

export function squareText(square: WordTileSquare): string {
  return { DL: t`2L`, TL: t`3L`, DW: t`2W`, TW: t`3W`, start: '★' }[square];
}

function squareName(square: WordTileSquare): string {
  return {
    DL: t`double letter`,
    TL: t`triple letter`,
    DW: t`double word`,
    TW: t`triple word`,
    start: t`start, double word`,
  }[square];
}

function squareOf(cell: number): WordTileSquare | null {
  if (cell === CENTER_CELL) return 'start';
  return bonusSquareAt(cell);
}

type Shown = { readonly letter: string; readonly blank: boolean } | null;

function cellLabel(
  cell: number,
  shown: Shown,
  state: WordTileBoardCell['state']
): string {
  const name = cellName(cell);
  const square = squareOf(cell);
  if (shown === null)
    return square === null
      ? t`${name}, empty`
      : `${squareText(square)}, ${t`${name}, ${squareName(square)}, empty`}`;
  const points = shown.blank ? 0 : letterPoints(shown.letter);
  const letter = shown.letter;
  const kind =
    state === 'tentative'
      ? shown.blank
        ? t`your tentative blank as ${letter}`
        : t`your tentative tile`
      : shown.blank
        ? t`blank played as ${letter}`
        : t`committed`;
  return `${letter} ${points}, ${name}, ${kind}`;
}

/** The board as the viewer sees it: committed tiles and their own tentative ones. */
export function boardCells(
  position: WordTilesPosition,
  candidate: Candidate,
  editable: boolean
): readonly WordTileBoardCell[] {
  return Array.from({ length: CELL_COUNT }, (_, cell) => {
    const committed = position.board[cell] ?? '.';
    const tentative = candidate.placed.find((p) => p.cell === cell);
    const shown: Shown =
      committed !== '.'
        ? {
            letter: committed.toUpperCase(),
            blank: committed !== committed.toUpperCase(),
          }
        : tentative === undefined
          ? null
          : {
              letter: tentative.assigned ?? tileSymbol(tentative.tile),
              blank: tentative.assigned !== null,
            };
    const state: WordTileBoardCell['state'] =
      committed !== '.'
        ? 'committed'
        : tentative !== undefined
          ? 'tentative'
          : 'empty';
    return {
      id: cellName(cell),
      letter: shown?.letter ?? '',
      points:
        shown === null ? null : shown.blank ? 0 : letterPoints(shown.letter),
      square: squareOf(cell),
      state,
      label: cellLabel(cell, shown, state),
      enabled: editable && committed === '.',
    };
  });
}

/** The viewer's rack, in their own order, each tile described. */
export function rackTiles(
  candidate: Candidate,
  editable: boolean
): readonly TileRackTile[] {
  return candidate.order.flatMap((id) => {
    const tile = tileOf(id);
    if (tile === null) return [];
    const placed = candidate.placed.some((p) => p.tile === id);
    const selected =
      candidate.exchange?.includes(id) ?? candidate.selected === id;
    const letter = tile.symbol === '?' ? '' : tile.symbol;
    const points = tile.points;
    const name = letter === '' ? t`Blank` : letter;
    const state = placed ? t`on the board` : selected ? t`selected` : '';
    return [
      {
        id: String(id),
        letter,
        points,
        selected,
        placed,
        label: `${name}, ${t`${points} points`}${state === '' ? '' : `, ${state}`}`,
        enabled: editable && !placed,
      },
    ];
  });
}
