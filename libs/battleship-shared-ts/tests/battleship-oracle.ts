import { battleshipRules } from '@libs/battleship-shared-ts/battleship-rules';
import type {
  GameSetups,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

/**
 * Independent test oracles: the fleet spelling and board geometry written
 * again from the rules' own words, never by calling the package's parser.
 */
const LETTERS = 'abcdefghij';
export const LENGTHS: Readonly<Record<string, number>> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};
export const CANONICAL = Object.keys(LENGTHS);
export type Point = { readonly c: number; readonly r: number };
export const point = (cell: string): Point => ({
  c: LETTERS.indexOf(cell[0]!),
  r: Number(cell.slice(1)) - 1,
});
export const token = (p: Point): string => `${LETTERS[p.c]}${p.r + 1}`;
export const rules = battleshipRules;
export const setupRules = battleshipRules.setup!;

/** Which ship occupies each cell of the spelled fleet (assumed well formed). */
export function occupancy(setup: string): ReadonlyMap<string, string> {
  const cells = new Map<string, string>();
  for (const entry of setup.slice('fleet:'.length).split(';')) {
    const [ship, place] = entry.split('@') as [string, string];
    const bow = point(place.slice(0, -1));
    const across = place.endsWith('h');
    for (let n = 0; n < LENGTHS[ship]!; n++)
      cells.set(
        token({ c: bow.c + (across ? n : 0), r: bow.r + (across ? 0 : n) }),
        ship
      );
  }
  return cells;
}
/** The canonical spelling of a fleet given each ship's cells. */
export function spellFleet(ships: ReadonlyMap<string, readonly Point[]>) {
  const entries = CANONICAL.map((ship) => {
    const cells = [...ships.get(ship)!].sort((a, b) => a.r - b.r || a.c - b.c);
    const across = cells.every((p) => p.r === cells[0]!.r);
    return `${ship}@${token(cells[0]!)}${across ? 'h' : 'v'}`;
  });
  return `fleet:${entries.join(';')}`;
}
export type Transform = (p: Point) => Point;
export const TRANSFORMS: Readonly<Record<string, Transform>> = {
  transpose: (p) => ({ c: p.r, r: p.c }),
  'mirror columns': (p) => ({ c: 9 - p.c, r: p.r }),
  'mirror rows': (p) => ({ c: p.c, r: 9 - p.r }),
  'rotate half turn': (p) => ({ c: 9 - p.c, r: 9 - p.r }),
};
export function transformFleet(setup: string, transform: Transform): string {
  const ships = new Map<string, Point[]>();
  for (const [cell, ship] of occupancy(setup))
    ships.set(ship, [...(ships.get(ship) ?? []), transform(point(cell))]);
  return spellFleet(ships);
}
export const other = (side: GameSide): GameSide =>
  side === 'white' ? 'black' : 'white';

export type Step = {
  readonly mover: GameSide;
  readonly proposal: string;
  readonly action: string;
  readonly before: string;
  readonly played: PlayedPosition;
};
export type Chooser = (position: string, mover: GameSide) => string | null;
/** Two random fleets drawn from `seed`. */
export function seededFleets(seed: string): GameSetups {
  const rng = createSeededRng(`battleship-fleets-${seed}`);
  return {
    white: setupRules.random(rng.fork('white').random),
    black: setupRules.random(rng.fork('black').random),
  };
}
/** Plays `choose`'s proposals, resolved with `fleets`, for at most `plies`. */
export function playOut(fleets: GameSetups, choose: Chooser, plies = 200) {
  let position = rules.initial();
  const actions: string[] = [];
  const steps: Step[] = [];
  for (let ply = 0; ply < plies; ply++) {
    const mover: GameSide = ply % 2 === 0 ? 'white' : 'black';
    const proposal = choose(position, mover);
    if (proposal === null) break;
    const action = setupRules.resolve(position, proposal, fleets);
    if (action === null) throw new Error(`${proposal} was not resolved`);
    const played = rules.play(position, action, '', actions);
    if (played === null) throw new Error(`${action} was refused`);
    steps.push({ mover, proposal, action, before: position, played });
    actions.push(action);
    position = played.position;
    if (played.winner !== null) break;
  }
  return { position, actions, steps };
}
/** A chooser drawing uniformly among the legal cells with a seeded stream. */
export function randomChooser(seed: string): Chooser {
  const rng = createSeededRng(`battleship-shots-${seed}`);
  return (position) => {
    const legal = rules.legal(position);
    return legal.length === 0 ? null : rng.pick(legal);
  };
}
