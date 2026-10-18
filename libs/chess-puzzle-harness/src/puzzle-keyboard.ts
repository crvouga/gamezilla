/**
 * Puzzles with the keyboard alone and by listening: Tab reaches each puzzle
 * control and Enter presses it; the arrow keys walk the board and Enter
 * picks a piece up and puts it down; the puzzle's live region is what
 * someone listening to the app hears.
 */

import {
  readPuzzleState,
  waitNextPuzzle,
  waitPuzzleHelp,
} from '@libs/game-session-harness/puzzle-screen';
import {
  actorPage,
  keyboardElement,
  pressTab,
  tabTo,
} from '@libs/harness/actor-page';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared/visibility';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { readPuzzleBoardProbe } from './chess-puzzle-solve-ui';

const WAIT_MS = 15_000;
const POLL_MS = 100;
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

/** Tab to the control and press Enter on it. */
async function pressWithKeyboard(
  s: ProductHarness,
  actorId: string,
  testId: string
): Promise<void> {
  await tabTo(s, actorId, testId);
  await press(s, actorId, 'enter');
}

async function waitStatus(
  s: ProductHarness,
  actorId: string,
  status: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await readPuzzleState(s, actorId)) === status ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: `puzzle ${status}` }
  );
}

async function visible(
  s: ProductHarness,
  actorId: string,
  testId: string
): Promise<boolean> {
  return (await actorUi(s, actorId)).get(testId).isVisible();
}

export type PuzzleKeyboardControl =
  | 'hint'
  | 'retry'
  | 'solution'
  | 'skip'
  | 'next';

async function showSolutionWithKeyboard(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  // After a wrong move the bar has its own Solution action; while solving
  // the one hint button escalates Hint → Solution → the whole line.
  if (await visible(s, actorId, Handles.chessPuzzleActionSolution)) {
    await pressWithKeyboard(s, actorId, Handles.chessPuzzleActionSolution);
  } else {
    for (let presses = 0; presses < 3; presses += 1) {
      if ((await readPuzzleState(s, actorId)) === 'revealed') break;
      await pressWithKeyboard(s, actorId, Handles.chessPuzzleActionHint);
    }
  }
  await waitStatus(s, actorId, 'revealed');
}

async function retryWithKeyboard(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  if (await visible(s, actorId, Handles.chessPuzzleSummary)) {
    await pressWithKeyboard(s, actorId, Handles.chessPuzzleSummaryClose);
  }
  await pressWithKeyboard(s, actorId, Handles.chessPuzzleActionRetry);
  await waitStatus(s, actorId, 'solving');
}

async function nextWithKeyboard(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const next = (await visible(s, actorId, Handles.chessPuzzleSummaryNext))
    ? Handles.chessPuzzleSummaryNext
    : Handles.chessPuzzleActionNext;
  await pressWithKeyboard(s, actorId, next);
  await waitNextPuzzle(s, actorId);
}

/** Use one puzzle control with the keyboard alone. */
export const usePuzzleControlWithKeyboard = scenarioAction({
  name: 'usePuzzleControlWithKeyboard',
  act: async (s, actorId: string, control: PuzzleKeyboardControl) => {
    if (control === 'hint') {
      await pressWithKeyboard(s, actorId, Handles.chessPuzzleActionHint);
      await waitPuzzleHelp(s, actorId, 'highlight');
    } else if (control === 'skip') {
      await pressWithKeyboard(s, actorId, Handles.chessPuzzleActionSkip);
      await waitStatus(s, actorId, 'skipped');
    } else if (control === 'solution') {
      await showSolutionWithKeyboard(s, actorId);
    } else if (control === 'retry') {
      await retryWithKeyboard(s, actorId);
    } else {
      await nextWithKeyboard(s, actorId);
    }
  },
});

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
