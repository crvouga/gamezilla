/**
 * What a person sees of Battleship on their Game Session screen, read off what
 * is rendered: the setup board they arrange their fleet on, their own board
 * and their targeting board, each cell as its mark (its tone), the words it
 * is read out with (its label) and the glyph drawn in it, and the board's
 * live announcement. Nothing here reads a fleet or a stored row: a cell's
 * ship is the one its label names, if any.
 */

import {
  CELLS,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';
import { GAME_SESSION_BOARD } from '@libs/game-session-harness-ts/game-session-moves';
import {
  type GameSessionScreen,
  readGameSessionScreen,
} from '@libs/game-session-harness-ts/game-session-screen';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml, bringToFront } from '@libs/harness-ts/observations';
import {
  type BattleshipBoardShown,
  boardShownIn,
  boardsShownIn,
} from './battleship-boards-shown';

export type {
  BattleshipBoardShown,
  BattleshipCellShown,
  BattleshipMark,
} from './battleship-boards-shown';

/** The setup board a person arranges their fleet on while the game is set up. */
export const BATTLESHIP_SETUP_BOARD = 'game-session-setup';
/** The frame's live line about the turn, which carries the latest shot. */
const GAME_SESSION_STATUS = 'game-session-status';

export type BattleshipView = {
  readonly screen: GameSessionScreen;
  /** The setup board, empty unless the person is arranging a fleet. */
  readonly setup: BattleshipBoardShown;
  /** The person's own board in the game: their fleet and the shots at it. */
  readonly own: BattleshipBoardShown;
  /** The person's targeting board: what their own shots found. */
  readonly target: BattleshipBoardShown;
};

/** The Battleship boards `actor` sees now. */
export async function battleshipView(
  s: ProductHarness,
  actor: string
): Promise<BattleshipView> {
  await actorUi(s, actor);
  await bringToFront(s, actor);
  const screen = await readGameSessionScreen(s, actor);
  if (screen === null) throw new Error(`${actor} sees no Battleship game`);
  const html = (await actorHtml(s, actor)) ?? '';
  return {
    screen,
    setup: boardShownIn(html, `${BATTLESHIP_SETUP_BOARD}-cell-`),
    ...boardsShownIn(html, GAME_SESSION_BOARD),
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
  return shownText(s, actor, 'game-session-setup-status');
}

/**
 * What a person listening to the app hears the Battleship game announce: the
 * frame's live turn line (the latest shot and whose turn it is), which must
 * be announced politely and not be hidden from assistive technology.
 */
export async function battleshipHeard(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const page = await actorPage(s, actor);
  const status = page.querySelector(
    `[data-actor="${actor}"] [data-testid="${GAME_SESSION_STATUS}"]`
  );
  if (
    status === null ||
    status.getAttribute('role') !== 'status' ||
    status.getAttribute('aria-live') !== 'polite' ||
    status.closest('[aria-hidden="true"], [hidden]') !== null
  )
    throw new Error('the Battleship turn line is not announced');
  return status.textContent ?? '';
}
