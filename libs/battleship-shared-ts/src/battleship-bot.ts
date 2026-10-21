import type {
  BotDifficulty,
  GameBots,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { BOT_DIFFICULTIES } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  cellCoordinates,
  offsetCell,
  orthogonalNeighbours,
} from './battleship-board';
import { densestCell } from './battleship-bot-density';
import { drawIndex } from './battleship-fleet';
import { type ShotIntel, shotIntel } from './battleship-intel';
import { readBattleshipPosition } from './battleship-position';

const AXES = [
  { dc: 1, dr: 0 },
  { dc: 0, dr: 1 },
] as const;
type Axis = (typeof AXES)[number];

function pick(cells: readonly string[], random: () => number): string | null {
  return cells.length === 0 ? null : cells[drawIndex(random, cells.length)]!;
}
function distinct(cells: readonly string[]): readonly string[] {
  return [...new Set(cells)];
}
/** The first cells past each end of the run of `hits` through `cell` along `axis`. */
function runEnds(
  cell: string,
  axis: Axis,
  hits: ReadonlySet<string>
): readonly string[] {
  const ends: string[] = [];
  for (const direction of [1, -1]) {
    let step = 1;
    let next = offsetCell(cell, axis, direction * step);
    while (next !== null && hits.has(next))
      next = offsetCell(cell, axis, direction * ++step);
    if (next !== null) ends.push(next);
  }
  return ends;
}
/**
 * Where to follow up unresolved hits: past the ends of a line of two or
 * more aligned hits first, else any unshot orthogonal neighbour.
 */
function targetCells(intel: ShotIntel): readonly string[] {
  const hits = new Set(intel.unresolved);
  const open = (cell: string) => !intel.targeted.has(cell);
  const extensions = intel.unresolved.flatMap((cell) =>
    AXES.filter((axis) => {
      const next = offsetCell(cell, axis);
      return next !== null && hits.has(next);
    }).flatMap((axis) => runEnds(cell, axis, hits))
  );
  const lined = distinct(extensions.filter(open));
  if (lined.length > 0) return lined;
  return distinct(intel.unresolved.flatMap(orthogonalNeighbours).filter(open));
}
/** Hunt on one colour of the checkerboard: no ship fits between its cells. */
function huntCells(intel: ShotIntel): readonly string[] {
  const parity = intel.legal.filter((cell) => {
    const at = cellCoordinates(cell)!;
    return (at.column + at.row) % 2 === 0;
  });
  return parity.length > 0 ? parity : intel.legal;
}
function huntAndTarget(intel: ShotIntel, random: () => number): string | null {
  const targets = targetCells(intel);
  return pick(targets.length > 0 ? targets : huntCells(intel), random);
}
/**
 * The bot's shot at `position`, from the public shots alone — it is never
 * given a fleet. `null` exactly when the side to move has no legal shot.
 */
export function chooseBattleshipShot(
  position: string,
  difficulty: BotDifficulty,
  random: () => number
): string | null {
  const battle = readBattleshipPosition(position);
  if (battle === null) return null;
  const intel = shotIntel(battle);
  if (intel.legal.length === 0) return null;
  if (difficulty === 'easy') return pick(intel.legal, random);
  if (difficulty === 'medium') return huntAndTarget(intel, random);
  return densestCell(intel, random);
}
export const battleshipBots: GameBots = {
  difficulties: BOT_DIFFICULTIES,
  choose: chooseBattleshipShot,
};
