import {
  isShipId,
  offsetCell,
  SHIPS,
  type ShipId,
  shipLength,
} from '@libs/battleship-shared/battleship-board';
import {
  FLEET_PREFIX,
  type Orientation,
  type PlacedShip,
  type Placement,
  placementCells,
} from '@libs/battleship-shared/battleship-fleet';

/**
 * A fleet being arranged: the `fleet:` spelling with only the ships placed
 * so far, in canonical order (`''` before anything is placed). With all five
 * placed it is exactly the canonical fleet.
 */
export type Draft = ReadonlyMap<ShipId, PlacedShip>;
export type PlacementRefusal =
  | { readonly kind: 'off-board' }
  | { readonly kind: 'overlap'; readonly other: ShipId };
export type PlacementOutcome =
  | { readonly ok: true; readonly draft: Draft }
  | { readonly ok: false; readonly refusal: PlacementRefusal };
export type PlacementPreview = {
  /** The board cells the ship would cover; fewer than its length off the board. */
  readonly cells: readonly string[];
  readonly valid: boolean;
};

const ENTRY_PATTERN = /^([a-z]+)@([a-j](?:10|[1-9]))([hv])$/;

function parseEntry(entry: string): PlacedShip | null {
  const match = ENTRY_PATTERN.exec(entry);
  const ship = match?.[1];
  if (match === null || ship === undefined || !isShipId(ship)) return null;
  const orientation: Orientation = match[3] === 'v' ? 'v' : 'h';
  const placement = { bow: match[2] ?? '', orientation };
  const length = shipLength(ship);
  const cells = placementCells(placement, length);
  return cells === null ? null : { ship, length, ...placement, cells };
}
/** The ships `setup` places; anything unreadable, repeated or overlapping is left out. */
export function parseDraft(setup: string): Draft {
  const draft = new Map<ShipId, PlacedShip>();
  if (!setup.startsWith(FLEET_PREFIX)) return draft;
  const occupied = new Set<string>();
  for (const entry of setup.slice(FLEET_PREFIX.length).split(';')) {
    const ship = parseEntry(entry);
    if (ship === null || draft.has(ship.ship)) continue;
    if (ship.cells.some((cell) => occupied.has(cell))) continue;
    for (const cell of ship.cells) occupied.add(cell);
    draft.set(ship.ship, ship);
  }
  return draft;
}
/** The draft's spelling, ships in canonical order. */
export function encodeDraft(draft: Draft): string {
  const entries = SHIPS.flatMap(({ id }) => {
    const ship = draft.get(id);
    return ship === undefined ? [] : [`${id}@${ship.bow}${ship.orientation}`];
  });
  return entries.length === 0 ? '' : FLEET_PREFIX + entries.join(';');
}
/** The placed ship covering `cell`, or `null` on open water. */
export function draftShipAt(draft: Draft, cell: string): PlacedShip | null {
  for (const ship of draft.values()) if (ship.cells.includes(cell)) return ship;
  return null;
}
/** The ships still to place, in canonical order. */
export function unplacedShips(draft: Draft): readonly ShipId[] {
  return SHIPS.map((ship) => ship.id).filter((id) => !draft.has(id));
}
/** The ship placed elsewhere that `cells` would overlap, if any. */
function overlapping(
  draft: Draft,
  ship: ShipId,
  cells: readonly string[]
): ShipId | null {
  for (const cell of cells) {
    const other = draftShipAt(draft, cell);
    if (other !== null && other.ship !== ship) return other.ship;
  }
  return null;
}
/**
 * `draft` with `ship` at `placement` (moving it when it was placed), or why
 * not: a ship never runs off the board or overlaps another.
 */
export function placeInDraft(
  draft: Draft,
  ship: ShipId,
  placement: Placement
): PlacementOutcome {
  const length = shipLength(ship);
  const cells = placementCells(placement, length);
  if (cells === null) return { ok: false, refusal: { kind: 'off-board' } };
  const other = overlapping(draft, ship, cells);
  if (other !== null) return { ok: false, refusal: { kind: 'overlap', other } };
  const next = new Map(draft);
  next.set(ship, { ship, length, ...placement, cells });
  return { ok: true, draft: next };
}
/** `draft` without `ship`. */
export function removeFromDraft(draft: Draft, ship: ShipId): Draft {
  const next = new Map(draft);
  next.delete(ship);
  return next;
}
/** The cells `ship` would cover from `placement`, and whether it may go there. */
export function previewPlacement(
  draft: Draft,
  ship: ShipId,
  placement: Placement
): PlacementPreview {
  const delta =
    placement.orientation === 'h' ? { dc: 1, dr: 0 } : { dc: 0, dr: 1 };
  const length = shipLength(ship);
  const cells = Array.from({ length }, (_, step) =>
    offsetCell(placement.bow, delta, step)
  ).filter((cell): cell is string => cell !== null);
  return {
    cells,
    valid: cells.length === length && overlapping(draft, ship, cells) === null,
  };
}
