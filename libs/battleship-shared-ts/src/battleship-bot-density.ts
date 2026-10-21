import { SHIPS } from './battleship-board';
import { allPlacements, drawIndex } from './battleship-fleet';
import type { ShotIntel } from './battleship-intel';

/** How much more a placement through an unresolved hit counts, per hit. */
const HIT_WEIGHT = 20;
/** Each ship length's in-bounds placements, computed once. */
const PLACEMENTS = new Map(
  [...new Set(SHIPS.map((ship) => ship.length))].map((length) => [
    length,
    allPlacements(length).map((placement) => placement.cells),
  ])
);

/**
 * How many placements of the ships still afloat cover each cell, avoiding
 * misses and cells credited to sunk ships; a placement through unresolved
 * hits counts `HIT_WEIGHT` times more for each one it covers. Bounded:
 * at most 5 ships × 180 placements × 5 cells.
 */
export function shotDensity(intel: ShotIntel): ReadonlyMap<string, number> {
  const unresolved = new Set(intel.unresolved);
  const density = new Map<string, number>();
  for (const ship of intel.afloat)
    for (const cells of PLACEMENTS.get(ship.length) ?? []) {
      if (
        cells.some(
          (cell) => intel.misses.has(cell) || intel.attributed.has(cell)
        )
      )
        continue;
      const covered = cells.filter((cell) => unresolved.has(cell)).length;
      const weight = HIT_WEIGHT ** covered;
      for (const cell of cells)
        if (!intel.targeted.has(cell))
          density.set(cell, (density.get(cell) ?? 0) + weight);
    }
  return density;
}
/** The legal cell most placements cover, ties drawn with `random`. */
export function densestCell(
  intel: ShotIntel,
  random: () => number
): string | null {
  if (intel.legal.length === 0) return null;
  const density = shotDensity(intel);
  const weightOf = (cell: string) => density.get(cell) ?? 0;
  const best = Math.max(...intel.legal.map(weightOf));
  const densest = intel.legal.filter((cell) => weightOf(cell) === best);
  return densest[drawIndex(random, densest.length)]!;
}
