/**
 * Battleship boards read off rendered markup alone: each cell as its mark
 * (its tone), the words it is read out with (its label) and the glyph drawn
 * in it. It loads no client code and no harness, so a journey on a real
 * browser reads boards the same way as the simulated app does. Nothing here
 * reads a fleet or a stored row: a cell's ship is the one its label names.
 */

import {
  CELLS,
  FLEET_CELL_COUNT,
  SHIP_IDS,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';

/** A cell's mark: open water, a ship of one's own, or what a shot found. */
export type BattleshipMark = 'open' | 'ship' | 'miss' | 'hit' | 'sunk';

export type BattleshipCellShown = {
  readonly mark: BattleshipMark;
  /** The ship the cell's label names, `null` when it names none. */
  readonly ship: ShipId | null;
  /** The words the cell is read out with. */
  readonly label: string;
  /** What is drawn in the cell. */
  readonly glyph: string;
  /** Whether pressing it does anything. */
  readonly enabled: boolean;
};

/** A board by cell (`a1` … `j10`); empty when it is not on screen. */
export type BattleshipBoardShown = Readonly<
  Record<string, BattleshipCellShown>
>;

const MARKS: Readonly<Record<string, BattleshipMark>> = {
  open: 'open',
  occupied: 'ship',
  quiet: 'miss',
  alert: 'hit',
  critical: 'sunk',
};

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function unescape(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);
}

function attributes(tag: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const match of tag.matchAll(/([a-z-]+)="([^"]*)"/g))
    found.set(match[1]!, unescape(match[2]!));
  return found;
}

/** The ship a cell's words name, if any. */
function namedShip(label: string): ShipId | null {
  const words = label.toLowerCase();
  // "Battleship" is also the game's name; a cell names it only as a ship.
  return (
    SHIP_IDS.find((ship) => new RegExp(`\\b${ship}\\b`).test(words)) ?? null
  );
}

/** Every cell button in `html` whose test id is `${prefix}${cell}`, by cell. */
export function boardShownIn(
  html: string,
  prefix: string
): BattleshipBoardShown {
  const board: Record<string, BattleshipCellShown> = {};
  for (const match of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = attributes(match[1]!);
    const testId = attrs.get('data-testid') ?? '';
    if (!testId.startsWith(prefix)) continue;
    const cell = testId.slice(prefix.length);
    if (!CELLS.includes(cell)) continue;
    const label = attrs.get('aria-label') ?? '';
    board[cell] = {
      mark: MARKS[attrs.get('data-tone') ?? ''] ?? 'open',
      ship: namedShip(label),
      label,
      glyph: unescape(match[2]!.replace(/<[^>]*>/g, '')).trim(),
      enabled: attrs.get('aria-disabled') === 'false',
    };
  }
  return board;
}

/** A person's two boards in a game: their own waters and their targeting. */
export type BattleshipBoardsShown = {
  /** Their fleet and the shots fired at it. */
  readonly own: BattleshipBoardShown;
  /** What their own shots found. */
  readonly target: BattleshipBoardShown;
};

/** The own and targeting boards of the game board `board` in `html`. */
export function boardsShownIn(
  html: string,
  board: string
): BattleshipBoardsShown {
  return {
    own: boardShownIn(html, `${board}-own-`),
    target: boardShownIn(html, `${board}-target-`),
  };
}

/** The cells each ship of its owner sits on, as an own board shows them. */
export function fleetShown(
  own: BattleshipBoardShown
): ReadonlyMap<ShipId, readonly string[]> {
  const fleet = new Map<ShipId, string[]>();
  for (const cell of CELLS) {
    const shown = own[cell];
    if (shown === undefined || shown.ship === null || shown.mark === 'open')
      continue;
    fleet.set(shown.ship, [...(fleet.get(shown.ship) ?? []), cell]);
  }
  return fleet;
}

/** Whether an own board shows its owner's whole fleet: every ship, every cell. */
export function wholeFleetShown(own: BattleshipBoardShown): boolean {
  const fleet = fleetShown(own);
  return (
    fleet.size === SHIP_IDS.length &&
    [...fleet.values()].flat().length === FLEET_CELL_COUNT
  );
}

/** How a setup spells a ship on `cells` (`cruiser@b3v`): bow first, then its way. */
function placement(ship: ShipId, cells: readonly string[]): string {
  const [bow, next] = cells;
  const across = next === undefined || next.slice(1) === bow?.slice(1);
  return `${ship}@${bow ?? ''}${across ? 'h' : 'v'}`;
}

/**
 * How many things the viewer's screen showed of the rival's fleet beyond
 * what the viewer's shots found: a targeting cell drawn or named as a ship
 * that no shot struck, and a ship the viewer has not sunk spelled where it
 * sits anywhere in what the viewer's screen holds (`viewerHtml`) — unless
 * the viewer's own fleet has the same placement. Zero when it stayed
 * private. It counts and names no cell, so a failure leaks nothing.
 */
export function fleetSeenBeyondShots(input: {
  readonly viewerHtml: string;
  readonly viewer: BattleshipBoardsShown;
  readonly rivalOwn: BattleshipBoardShown;
}): number {
  const { target } = input.viewer;
  const drawn = CELLS.filter((cell) => {
    const shown = target[cell];
    if (shown === undefined || shown.mark === 'hit' || shown.mark === 'sunk')
      return false;
    return shown.mark === 'ship' || shown.ship !== null;
  }).length;
  const own = new Set(
    [...fleetShown(input.viewer.own)].map(([ship, cells]) =>
      placement(ship, cells)
    )
  );
  const spelled = [...fleetShown(input.rivalOwn)].filter(([ship, cells]) => {
    const sunk = cells.every((cell) => target[cell]?.mark === 'sunk');
    const spelling = placement(ship, cells);
    return !sunk && !own.has(spelling) && input.viewerHtml.includes(spelling);
  }).length;
  return drawn + spelled;
}
