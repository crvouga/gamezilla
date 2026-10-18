/**
 * Puzzles of any game with the keyboard alone and by listening: Tab reaches
 * each of the platform's puzzle controls and Enter presses it, and the
 * platform's live region about the attempt's results is what someone
 * listening to the app hears of a wrong move, a solve and the rating
 * change. A game's own words about its moves are its companion's.
 */

import { actorPage, tabTo } from '@libs/harness/actor-page';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared/visibility';
import {
  readPuzzleState,
  waitNextPuzzle,
  waitPuzzleHelp,
} from './puzzle-screen';

const WAIT_MS = 15_000;
const POLL_MS = 100;

/** Tab to the control and press Enter on it. */
async function pressWithKeyboard(
  s: ProductHarness,
  actorId: string,
  testId: string
): Promise<void> {
  await tabTo(s, actorId, testId);
  const ui = await actorUi(s, actorId);
  await ui.key('enter');
  await s.session.waitForIdle();
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
  if (await visible(s, actorId, Handles.chessPuzzleSummary))
    await pressWithKeyboard(s, actorId, Handles.chessPuzzleSummaryClose);
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

export type PuzzleResultHeard = {
  /** What the platform's live region about the attempt says right now. */
  readonly words: string;
  /** Accessibility failures on the page, as a person would place them. */
  readonly problems: readonly string[];
};

/** What someone listening to the app hears of the attempt's results. */
export async function readPuzzleResultHeard(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleResultHeard> {
  const page = await actorPage(s, actorId);
  const region = page.querySelector(
    `[data-testid="${Handles.puzzleResultAnnouncement}"]`
  );
  if (
    region === null ||
    isHiddenFromAt(region) ||
    region.getAttribute('role') !== 'status' ||
    region.getAttribute('aria-live') !== 'polite'
  )
    return { words: '', problems: ["the puzzle's results are not announced"] };
  return {
    words: region.textContent ?? '',
    problems: auditTree(page).map(formatFailure),
  };
}

/** Listen to the app: its page, as assistive technology reads it, on screen. */
export const listenToPuzzles = scenarioAction({
  name: 'listenToPuzzles',
  act: async (s, actorId: string) => {
    await actorPage(s, actorId);
  },
});

export const PUZZLE_LISTENING_ACTIONS = [
  usePuzzleControlWithKeyboard,
  listenToPuzzles,
];
