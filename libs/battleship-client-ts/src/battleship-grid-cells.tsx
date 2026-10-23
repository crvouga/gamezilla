import {
  CELLS,
  cellLabel,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';
import {
  type Fleet,
  type PlacedShip,
  shipAt,
} from '@libs/battleship-shared-ts/battleship-fleet';
import { sunkShipCells } from '@libs/battleship-shared-ts/battleship-intel';
import type { Shot } from '@libs/battleship-shared-ts/battleship-position';
import { t } from '@lingui/core/macro';
import type { CellGridCell } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { GLYPHS, shipName } from './battleship-copy';

export type ShotGrid = {
  /** The shots fired at this board, in order: public, never a fleet. */
  readonly shots: readonly Shot[];
  /** Untargeted cells fire when activated. */
  readonly interactive: boolean;
  /** The cell just fired at, waiting for its outcome. */
  readonly aiming: string | null;
};

function latest(shots: readonly Shot[]): string | null {
  return shots.at(-1)?.cell ?? null;
}
function withRecent(cell: CellGridCell, recent: boolean): CellGridCell {
  return recent
    ? { ...cell, emphasis: 'recent', label: t`${cell.label}, latest shot` }
    : cell;
}
/** Each cell a sunk ship is credited with, by the public shots alone. */
export function sunkByCell(
  shots: readonly Shot[]
): ReadonlyMap<string, ShipId> {
  const byCell = new Map<string, ShipId>();
  for (const [ship, cells] of sunkShipCells(shots))
    for (const cell of cells) byCell.set(cell, ship);
  return byCell;
}
function firedCell(
  shot: Shot,
  sunk: ShipId | undefined,
  label: string
): CellGridCell {
  const id = shot.cell;
  if (sunk !== undefined) {
    const name = shipName(sunk);
    return {
      id,
      glyph: GLYPHS.sunk,
      tone: 'critical',
      outlined: true,
      enabled: false,
      label: t`${label}: hit, sunk ${name}`,
    };
  }
  return shot.outcome === 'miss'
    ? {
        id,
        glyph: GLYPHS.miss,
        tone: 'quiet',
        enabled: false,
        label: t`${label}: miss`,
      }
    : {
        id,
        glyph: GLYPHS.hit,
        tone: 'alert',
        enabled: false,
        label: t`${label}: hit`,
      };
}
function openCell(cell: string, grid: ShotGrid): CellGridCell {
  const label = cellLabel(cell);
  if (grid.aiming === cell)
    return {
      id: cell,
      glyph: GLYPHS.aiming,
      tone: 'open',
      emphasis: 'pending',
      enabled: false,
      label: t`${label}: fired, waiting for the result`,
    };
  return {
    id: cell,
    glyph: '',
    tone: 'open',
    enabled: grid.interactive,
    label: grid.interactive ? t`Fire at ${label}` : t`${label}: not fired at`,
  };
}
/**
 * A board as everyone may see it: only the shots fired at it, with sunk
 * ships outlined where the shots place them. Nothing here reads a fleet.
 */
export function shotGridCells(grid: ShotGrid): readonly CellGridCell[] {
  const shots = new Map(grid.shots.map((shot) => [shot.cell, shot]));
  const sunk = sunkByCell(grid.shots);
  const recent = latest(grid.shots);
  return CELLS.map((cell) => {
    const shot = shots.get(cell);
    if (shot === undefined) return openCell(cell, grid);
    return withRecent(
      firedCell(shot, sunk.get(cell), cellLabel(cell)),
      cell === recent
    );
  });
}
function ownShipCell(
  cell: string,
  ship: PlacedShip,
  hits: ReadonlySet<string>
): CellGridCell {
  const label = cellLabel(cell);
  const name = shipName(ship.ship);
  if (ship.cells.every((part) => hits.has(part)))
    return {
      id: cell,
      glyph: GLYPHS.sunk,
      tone: 'critical',
      outlined: true,
      enabled: false,
      label: t`${label}: your ${name}, sunk`,
    };
  if (hits.has(cell))
    return {
      id: cell,
      glyph: GLYPHS.hit,
      tone: 'alert',
      enabled: false,
      label: t`${label}: your ${name}, hit`,
    };
  return {
    id: cell,
    glyph: GLYPHS.ship,
    tone: 'occupied',
    enabled: false,
    label: t`${label}: your ${name}`,
  };
}
function ownWaterCell(cell: string, missed: boolean): CellGridCell {
  const label = cellLabel(cell);
  return missed
    ? {
        id: cell,
        glyph: GLYPHS.miss,
        tone: 'quiet',
        enabled: false,
        label: t`${label}: open water, missed`,
      }
    : {
        id: cell,
        glyph: '',
        tone: 'open',
        enabled: false,
        label: t`${label}: open water`,
      };
}
/** The viewer's own board: their fleet and the shots fired at it. */
export function fleetGridCells(
  fleet: Fleet,
  shots: readonly Shot[]
): readonly CellGridCell[] {
  const hits = new Set(
    shots.filter((shot) => shot.outcome !== 'miss').map((shot) => shot.cell)
  );
  const fired = new Set(shots.map((shot) => shot.cell));
  const recent = latest(shots);
  return CELLS.map((cell) => {
    const ship = shipAt(fleet, cell);
    const view =
      ship === null
        ? ownWaterCell(cell, fired.has(cell))
        : ownShipCell(cell, ship, hits);
    return withRecent(view, cell === recent);
  });
}
