/**
 * Chess puzzles with the keyboard alone and by listening: the arrow keys
 * walk the board and Enter picks a piece up and puts it down; chess's live
 * region is what someone listening to the app hears of the moves. The
 * puzzle controls with the keyboard, and the results heard, are every
 * game's (`@libs/game-session-harness/puzzle-listening`).
 */

import { actorPage, keyboardElement, pressTab } from '@libs/harness/actor-page';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared/visibility';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { readPuzzleBoardProbe } from './chess-puzzle-solve-ui';

/** More arrow presses than any walk across the board takes. */
const MAX_ARROWS = 16;

/** Press `key` where the keyboard is, as a person at the keyboard does. */
async function press(
  s: ProductHarness,
  actorId: string,
  key: DriverKey
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.key(key);
  await s.session.waitForIdle();
}

// ------------------------------------------------------------- the board

function boardSquareUnderKeyboard(page: HTMLElement): string | null {
  const element = keyboardElement(page);
  if (element?.closest(`[data-testid="${Handles.chessPuzzleBoard}"]`) == null) {
    return null;
  }
  return element.getAttribute('data-square');
}

/** Tab until the keyboard is on the puzzle board. */
async function tabToBoard(s: ProductHarness, actorId: string): Promise<void> {
  const page = await actorPage(s, actorId);
  const lap = page.querySelectorAll('*').length;
  for (let presses = 0; presses <= lap; presses += 1) {
    if (boardSquareUnderKeyboard(page) !== null) return;
    await pressTab(s, page);
  }
  throw new Error(`${actorId}'s keyboard never reached the puzzle board`);
}

/** The arrow that walks from `at` toward `to`, as the board faces the solver. */
function arrowToward(
  at: string,
  to: string,
  orientation: 'white' | 'black'
): DriverKey {
  const flip = orientation === 'white' ? 1 : -1;
  const files = (to.charCodeAt(0) - at.charCodeAt(0)) * flip;
  const ranks = (to.charCodeAt(1) - at.charCodeAt(1)) * flip;
  if (files > 0) return 'arrowRight';
  if (files < 0) return 'arrowLeft';
  return ranks > 0 ? 'arrowUp' : 'arrowDown';
}

/** Walk the board's keyboard cursor to `square` and press Enter there. */
async function enterOnSquare(
  s: ProductHarness,
  actorId: string,
  square: string
): Promise<void> {
  const page = await actorPage(s, actorId);
  const orientation =
    (await readPuzzleBoardProbe(s, actorId))?.orientation ?? 'white';
  for (let presses = 0; presses <= MAX_ARROWS; presses += 1) {
    const at = boardSquareUnderKeyboard(page);
    if (at === null) throw new Error('the keyboard left the puzzle board');
    if (at === square) {
      await press(s, actorId, 'enter');
      return;
    }
    await press(s, actorId, arrowToward(at, square, orientation));
  }
  throw new Error(`the keyboard never reached ${square}`);
}

/** Play `uci` on the puzzle board with the keyboard alone. */
export const playPuzzleMoveWithKeyboard = scenarioAction({
  name: 'playPuzzleMoveWithKeyboard',
  act: async (s, actorId: string, uci: string) => {
    await tabToBoard(s, actorId);
    await enterOnSquare(s, actorId, uci.slice(0, 2));
    await enterOnSquare(s, actorId, uci.slice(2, 4));
  },
});

// ------------------------------------------------------------- listening

export type PuzzleHeard = {
  /** What the puzzle's live region says right now. */
  readonly words: string;
  /** Accessibility failures on the page, as a person would place them. */
  readonly problems: readonly string[];
};

/** What someone listening to the app hears about the puzzle. */
export async function readPuzzleHeard(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleHeard> {
  const page = await actorPage(s, actorId);
  const region = page.querySelector(
    `[data-testid="${Handles.chessPuzzleAnnouncement}"]`
  );
  if (
    region === null ||
    isHiddenFromAt(region) ||
    region.getAttribute('role') !== 'status' ||
    region.getAttribute('aria-live') !== 'polite'
  ) {
    return { words: '', problems: ['the puzzle is not announced'] };
  }
  return {
    words: region.textContent ?? '',
    problems: auditTree(page).map(formatFailure),
  };
}

/** Listen to the app: its page, as assistive technology reads it, on screen. */
export const listenToTheApp = scenarioAction({
  name: 'listenToTheApp',
  act: async (s, actorId: string) => {
    await actorPage(s, actorId);
  },
});
