import {
  offsetCell,
  SHIPS,
  type Ship,
  type ShipId,
  shipLength,
} from './battleship-board';
import { ORIENTATIONS, placementCells } from './battleship-fleet';
import {
  type BattleshipPosition,
  type Shot,
  untargetedCells,
} from './battleship-position';

/**
 * What a side knows about the board it shoots at, from the public shots
 * alone: no fleet is ever an input, so nothing here can depend on one.
 */
export type ShotIntel = {
  /** The cells it may still shoot, row-major. */
  readonly legal: readonly string[];
  readonly targeted: ReadonlySet<string>;
  readonly misses: ReadonlySet<string>;
  /** Cells credited to a ship it has sunk. */
  readonly attributed: ReadonlySet<string>;
  /** Hits not credited to a sunk ship, in the order fired. */
  readonly unresolved: readonly string[];
  /** Ships it has not sunk yet, in canonical order. */
  readonly afloat: readonly Ship[];
};

function sunkRun(
  shot: Shot & { readonly ship: ShipId },
  hits: ReadonlySet<string>,
  attributed: ReadonlySet<string>
): readonly string[] {
  const length = shipLength(shot.ship);
  for (const orientation of ORIENTATIONS) {
    const delta = orientation === 'h' ? { dc: 1, dr: 0 } : { dc: 0, dr: 1 };
    for (let before = 0; before < length; before++) {
      const bow = offsetCell(shot.cell, delta, -before);
      const cells =
        bow === null ? null : placementCells({ bow, orientation }, length);
      if (
        cells !== null &&
        cells.every((cell) => hits.has(cell) && !attributed.has(cell))
      )
        return cells;
    }
  }
  // Shots no fleet explains still credit the sinking cell itself.
  return [shot.cell];
}
/**
 * The cells each sunk ship is credited with: the straight run of its length
 * through the sinking shot, of hits not yet credited, the first such run
 * with horizontal before vertical and the bow nearest the board's start.
 */
export function sunkShipCells(
  shots: readonly Shot[]
): ReadonlyMap<ShipId, readonly string[]> {
  const hits = new Set<string>();
  const attributed = new Set<string>();
  const sunk = new Map<ShipId, readonly string[]>();
  for (const shot of shots) {
    if (shot.outcome === 'miss') continue;
    hits.add(shot.cell);
    const ship = shot.ship;
    if (ship === undefined) continue;
    const cells = sunkRun({ ...shot, ship }, hits, attributed);
    for (const cell of cells) attributed.add(cell);
    sunk.set(ship, cells);
  }
  return sunk;
}
/** What the side to move knows about the board it shoots at. */
export function shotIntel(battle: BattleshipPosition): ShotIntel {
  const shots = battle.shots[battle.turn];
  const sunk = sunkShipCells(shots);
  const attributed = new Set([...sunk.values()].flat());
  return {
    legal: untargetedCells(battle),
    targeted: new Set(shots.map((shot) => shot.cell)),
    misses: new Set(
      shots.filter((shot) => shot.outcome === 'miss').map((shot) => shot.cell)
    ),
    attributed,
    unresolved: shots
      .filter((shot) => shot.outcome !== 'miss' && !attributed.has(shot.cell))
      .map((shot) => shot.cell),
    afloat: SHIPS.filter((ship) => !sunk.has(ship.id)),
  };
}
