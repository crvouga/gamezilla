/**
 * What a person sees of Battleship on their Custom Game screen, read off what
 * is rendered: the setup board they arrange their fleet on, their own board
 * and their targeting board, each cell as its mark (its tone), the words it
 * is read out with (its label) and the glyph drawn in it, and the board's
 * live announcement. Nothing here reads a fleet or a stored row: a cell's
 * ship is the one its label names, if any.
 */

import {
  CELLS,
  SHIP_IDS,
  type ShipId,
} from '@libs/battleship-shared/battleship-board';
import { CUSTOM_GAME_BOARD } from '@libs/game-session-harness/custom-game-moves';
import {
  type CustomGameScreen,
  readCustomGameScreen,
} from '@libs/game-session-harness/custom-game-screen';
import { actorPage } from '@libs/harness/actor-page';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorHtml, bringToFront } from '@libs/harness/observations';

/** The setup board a person arranges their fleet on while the game is set up. */
export const BATTLESHIP_SETUP_BOARD = 'custom-game-setup';

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

export type BattleshipView = {
  readonly screen: CustomGameScreen;
  /** The setup board, empty unless the person is arranging a fleet. */
  readonly setup: BattleshipBoardShown;
  /** The person's own board in the game: their fleet and the shots at it. */
  readonly own: BattleshipBoardShown;
  /** The person's targeting board: what their own shots found. */
  readonly target: BattleshipBoardShown;
};

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

/** Every cell button whose test id is `${prefix}${cell}`, by cell. */
function boardIn(html: string, prefix: string): BattleshipBoardShown {
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

/** The Battleship boards `actor` sees now. */
export async function battleshipView(
  s: ProductHarness,
  actor: string
): Promise<BattleshipView> {
  await actorUi(s, actor);
  await bringToFront(s, actor);
  const screen = await readCustomGameScreen(s, actor);
  if (screen === null) throw new Error(`${actor} sees no Battleship game`);
  const html = (await actorHtml(s, actor)) ?? '';
  return {
    screen,
    setup: boardIn(html, `${BATTLESHIP_SETUP_BOARD}-cell-`),
    own: boardIn(html, `${CUSTOM_GAME_BOARD}-own-`),
    target: boardIn(html, `${CUSTOM_GAME_BOARD}-target-`),
  };
}

/** The cells of `board` holding `ship`, as its labels name them, in board order. */
export function shipCells(
  board: BattleshipBoardShown,
  ship: ShipId
): readonly string[] {
  return CELLS.filter(
    (cell) => board[cell]?.ship === ship && board[cell]?.mark !== 'open'
  );
}

/** The cells of `board` marked by a shot (a miss, a hit or a sinking). */
export function shotCells(board: BattleshipBoardShown): readonly string[] {
  return CELLS.filter((cell) => {
    const mark = board[cell]?.mark;
    return mark === 'miss' || mark === 'hit' || mark === 'sunk';
  });
}

async function shownText(
  s: ProductHarness,
  actor: string,
  testId: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const node = ui.get(testId);
  return (await node.isVisible()) ? ((await node.text()) ?? '') : null;
}

/** What the setup board last refused and why, or `null` when nothing. */
export function battleshipSetupRefusal(s: ProductHarness, actor: string) {
  return shownText(s, actor, `${BATTLESHIP_SETUP_BOARD}-refusal`);
}

/** Whether the setup board tells the person their fleet is locked. */
export async function battleshipFleetLockedShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return (
    (await shownText(s, actor, `${BATTLESHIP_SETUP_BOARD}-locked`)) !== null
  );
}

/** What the person is told of their private setup: complete or incomplete. */
export function battleshipSetupStatus(s: ProductHarness, actor: string) {
  return shownText(s, actor, 'custom-game-setup-status');
}

/**
 * What a person listening to the app hears the Battleship board announce:
 * its live status, which must be announced politely and not be hidden from
 * assistive technology.
 */
export async function battleshipHeard(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const page = await actorPage(s, actor);
  const status = page.querySelector(
    `[data-actor="${actor}"] [data-testid="${CUSTOM_GAME_BOARD}-status"]`
  );
  if (
    status === null ||
    status.getAttribute('role') !== 'status' ||
    status.getAttribute('aria-live') !== 'polite' ||
    status.closest('[aria-hidden="true"], [hidden]') !== null
  )
    throw new Error('the Battleship board status is not announced');
  return status.textContent ?? '';
}
