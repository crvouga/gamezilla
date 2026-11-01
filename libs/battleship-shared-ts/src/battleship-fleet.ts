import {
  CELLS,
  isShipId,
  offsetCell,
  SHIP_IDS,
  SHIPS,
  type ShipId,
  shipLength,
} from './battleship-board';

/**
 * A fleet (a side's private setup) is spelled
 * `fleet:<ship>@<bow><h|v>;…` with its five ships in canonical order. The
 * bow is the top/left-most cell; `h` extends to increasing columns and `v`
 * to increasing rows.
 */
export const FLEET_PREFIX = 'fleet:';
const MAX_SETUP_LENGTH = 200;
const ENTRY_PATTERN = /^([a-z]+)@([a-j](?:10|[1-9]))([hv])$/;
export type Orientation = 'h' | 'v';
export const ORIENTATIONS: readonly Orientation[] = ['h', 'v'];
export type PlacedShip = {
  readonly ship: ShipId;
  readonly length: number;
  readonly bow: string;
  readonly orientation: Orientation;
  /** From the bow, in increasing column (`h`) or row (`v`). */
  readonly cells: readonly string[];
};
/** The five placed ships in canonical order. */
export type Fleet = readonly PlacedShip[];
export type Placement = {
  readonly bow: string;
  readonly orientation: Orientation;
};

/** The cells a ship of `length` covers from `bow`, or `null` off the board. */
export function placementCells(
  placement: Placement,
  length: number
): readonly string[] | null {
  const delta =
    placement.orientation === 'h' ? { dc: 1, dr: 0 } : { dc: 0, dr: 1 };
  const cells: string[] = [];
  for (let step = 0; step < length; step++) {
    const cell = offsetCell(placement.bow, delta, step);
    if (cell === null) return null;
    cells.push(cell);
  }
  return cells;
}
/** Every in-bounds placement of a ship of `length`, bow-major then `h`, `v`. */
export function allPlacements(
  length: number
): readonly (Placement & { readonly cells: readonly string[] })[] {
  return CELLS.flatMap((bow) =>
    ORIENTATIONS.flatMap((orientation) => {
      const cells = placementCells({ bow, orientation }, length);
      return cells === null ? [] : [{ bow, orientation, cells }];
    })
  );
}
/** Board geometry is fixed; fleet draws only filter the occupied cells. */
const FLEET_PLACEMENTS = new Map(
  [...new Set(SHIPS.map((ship) => ship.length))].map((length) => [
    length,
    allPlacements(length),
  ])
);
function parseEntry(entry: string): PlacedShip | null {
  const match = ENTRY_PATTERN.exec(entry);
  const ship = match?.[1];
  if (match === null || ship === undefined || !isShipId(ship)) return null;
  const length = shipLength(ship);
  const placement = { bow: match[2]!, orientation: match[3] as Orientation };
  const cells = placementCells(placement, length);
  return cells === null ? null : { ship, length, ...placement, cells };
}
/** Whether the ships are each fleet ship once, on distinct cells. */
function isCompleteFleet(ships: readonly PlacedShip[]): boolean {
  if (new Set(ships.map((ship) => ship.ship)).size !== SHIP_IDS.length)
    return false;
  const cells = ships.flatMap((ship) => ship.cells);
  return new Set(cells).size === cells.length;
}
/** The fleet `setup` spells, in canonical order, or `null` unless legal. */
export function parseFleet(setup: string): Fleet | null {
  if (setup.length > MAX_SETUP_LENGTH || !setup.startsWith(FLEET_PREFIX))
    return null;
  const entries = setup.slice(FLEET_PREFIX.length).split(';');
  if (entries.length !== SHIP_IDS.length) return null;
  const ships: PlacedShip[] = [];
  for (const entry of entries) {
    const ship = parseEntry(entry);
    if (ship === null) return null;
    ships.push(ship);
  }
  if (!isCompleteFleet(ships)) return null;
  return SHIP_IDS.map((id) => ships.find((ship) => ship.ship === id)!);
}
/** The canonical spelling of `fleet`. */
export function encodeFleet(fleet: Fleet): string {
  return (
    FLEET_PREFIX +
    fleet.map((ship) => `${ship.ship}@${ship.bow}${ship.orientation}`).join(';')
  );
}
/** The canonical spelling of `setup`, or `null` unless it is one legal fleet. */
export function acceptFleet(setup: string): string | null {
  const fleet = parseFleet(setup);
  return fleet === null ? null : encodeFleet(fleet);
}
/** The 17 cells the fleet occupies, ship by ship in canonical order. */
export function fleetCells(fleet: Fleet): readonly string[] {
  return fleet.flatMap((ship) => ship.cells);
}
/** The ship of `fleet` occupying `cell`, or `null` when it is open water. */
export function shipAt(fleet: Fleet, cell: string): PlacedShip | null {
  return fleet.find((ship) => ship.cells.includes(cell)) ?? null;
}
/** An index in `[0, count)` drawn from one `random` value, clamped. */
export function drawIndex(random: () => number, count: number): number {
  const value = random();
  if (!(value > 0)) return 0;
  return Math.min(count - 1, Math.floor(value * count));
}
/**
 * A legal fleet drawn with `random`: each ship in canonical order takes one
 * of its legal placements beside those already placed, uniformly. Fifteen
 * occupied cells can never block every placement of the last ship, so a
 * placement always exists and no draw is ever retried.
 */
export function randomFleet(random: () => number): string {
  const occupied = new Set<string>();
  const fleet: PlacedShip[] = [];
  for (const { id, length } of SHIPS) {
    const open = FLEET_PLACEMENTS.get(length)!.filter((placement) =>
      placement.cells.every((cell) => !occupied.has(cell))
    );
    if (open.length === 0) throw new Error(`No placement left for ${id}`);
    const chosen = open[drawIndex(random, open.length)]!;
    for (const cell of chosen.cells) occupied.add(cell);
    fleet.push({ ship: id, length, ...chosen });
  }
  return encodeFleet(fleet);
}
