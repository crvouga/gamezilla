/**
 * The platform's puzzle board as a person reaches and uses it, for any game
 * offering puzzles: the way in from the space's game choice and back, the
 * attempt's controls (hint, solution, retry, skip, moving on), and what the
 * board and its probes say — the attempt's state, the move of the line it
 * shows, the solver's side, the prompt, the rating change and the
 * puzzle's own rating and themes. Nothing here knows a game's board: a
 * move on it is the game's own gesture (`puzzle-moves`).
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront, visible } from '@libs/harness-ts/observations';
import { waitActiveSpace } from '@libs/spaces-harness-ts/space-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { RecordingHaptics } from '@pkgs/device-shared-ts/haptics';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';
import {
  openFeedSetting,
  openPuzzleFeed,
  openPuzzleLine,
  readPuzzlePlace,
  showPuzzleHome,
  waitPuzzleFeedClosed,
  waitPuzzleFeedHub,
} from './puzzle-places';

const WAIT_MS = 15_000;
const POLL_MS = 250;
/** How long a board that is never the solver's to move is waited for. */
const INTERACTIVE_MS = 2_500;

/** The board a puzzle is solved on, as the platform's play screen names it. */
export const PUZZLE_BOARD = Handles.chessPuzzleBoard;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

// ------------------------------------------------------------------ probes

/**
 * The attempt as the play screen's probe states it:
 * `status|interactive|solveIdx|line|next|hintStage|rating|themes`.
 */
export type PuzzleProbe = {
  /** `solving`, `wrong`, `solved`, `revealed`, `skipped`, … */
  readonly status: string;
  /** Whether the solver may move now. */
  readonly interactive: boolean;
  /** The move of the line the board shows (1: after the setup move). */
  readonly solveIdx: number;
  readonly line: string;
  /** The line's next solver move, while solving. */
  readonly next: string;
  readonly hintStage: string;
  readonly puzzleRating: number | null;
  readonly themes: readonly string[];
};

export async function readPuzzleProbe(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleTestDebug).text());
    const parts = raw.split('|');
    if (parts.length < 6) return null;
    const puzzleRating = Number.parseInt(parts[6] ?? '', 10);
    return {
      status: parts[0] ?? '',
      interactive: parts[1] === '1',
      solveIdx: Number.parseInt(parts[2] ?? '0', 10),
      line: parts[3] ?? '',
      next: parts[4] ?? '',
      hintStage: parts[5] ?? '',
      puzzleRating: Number.isFinite(puzzleRating) ? puzzleRating : null,
      themes: (parts[7] ?? '').split(',').filter((theme) => theme.length > 0),
    };
  } catch {
    return null;
  }
}

/** The attempt's state on the actor's board, or null off the board. */
export async function readPuzzleState(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPuzzleProbe(s, actorId))?.status ?? null;
}

/** The help on show: `none`, `highlight` or `solution`. */
export async function readPuzzleHelp(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPuzzleProbe(s, actorId))?.hintStage ?? null;
}

/** The position the puzzle board shows, in the game's own notation. */
export async function readPuzzleBoardPosition(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const position = stripProbe(
      await ui.get(Handles.chessPuzzleTestFen).text()
    );
    return position.length > 0 ? position : null;
  } catch {
    return null;
  }
}

/** The side the puzzle board faces (`white` / `black`), or null. */
export async function readPuzzleBoardFacing(
  s: ProductHarness,
  actorId: string
): Promise<'white' | 'black' | null> {
  try {
    const ui = await actorUi(s, actorId);
    const text = stripProbe(
      await ui.get(Handles.chessPuzzleBoardOrientation).text()
    );
    return text === 'white' || text === 'black' ? text : null;
  } catch {
    return null;
  }
}

/** A watcher's suggestion: who made it, and the cells it names. */
export type PuzzleSuggestionSeen = {
  readonly by: string;
  readonly from: string;
  readonly to: string;
};

/** Who watches, the header's kind, the clock and the suggestions shown. */
export type PuzzleWatchProbe = {
  readonly spectating: boolean;
  readonly role: 'host' | 'guest' | 'unknown';
  readonly statusKind: string;
  readonly clockMs: number | null;
  readonly suggestions: readonly PuzzleSuggestionSeen[];
};

/** `by:from-to` pairs, comma separated, oldest first: cells of any game. */
function parseSuggestions(raw: string): readonly PuzzleSuggestionSeen[] {
  if (raw.length === 0) return [];
  return raw.split(',').flatMap((entry) => {
    const [by, cells] = entry.split(':');
    const [from, to] = cells?.split('-') ?? [];
    if (by === undefined || !from || !to) return [];
    return [{ by, from, to }];
  });
}

export async function readPuzzleWatch(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleWatchProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(
      await ui.get(Handles.chessPuzzleTestSpectator).text()
    );
    const fields: Record<string, string> = {};
    for (const part of raw.split(' ')) {
      const at = part.indexOf('=');
      if (at > 0) fields[part.slice(0, at)] = part.slice(at + 1);
    }
    const clock = fields['clock'];
    const role = fields['role'];
    return {
      spectating: fields['spectating'] === '1',
      role: role === 'host' || role === 'guest' ? role : 'unknown',
      statusKind: fields['kind'] ?? '',
      clockMs: clock !== undefined && clock !== '-' ? Number(clock) : null,
      suggestions: parseSuggestions(fields['recs'] ?? ''),
    };
  } catch {
    return null;
  }
}

/** What the header says of the attempt (`started`, `solved`, …), or null. */
export async function readPuzzleStatusKind(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPuzzleWatch(s, actorId))?.statusKind ?? null;
}

async function readPickField(
  s: ProductHarness,
  actorId: string,
  key: string
): Promise<string | undefined> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzlePickStatus).text());
    for (const token of raw.split(/\s+/))
      if (token.startsWith(`${key}=`)) return token.slice(key.length + 1);
    return undefined;
  } catch {
    return undefined;
  }
}

/** The id of the puzzle on the actor's board, or null when there is none. */
export async function readPuzzleOnBoard(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const value = await readPickField(s, actorId, 'active');
  return value === undefined || value === 'null' || value.length === 0
    ? null
    : value;
}

/** Whether the attempt on the board can still move the rating. */
export async function isPuzzleAttemptRated(
  s: ProductHarness,
  actorId: string
): Promise<boolean | null> {
  const raw = await readPickField(s, actorId, 'rated');
  return raw === undefined ? null : raw === '1';
}

/** Where picking a puzzle stands (`ready`, `waiting`, `offline`, …). */
export async function readPuzzlePickState(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPickField(s, actorId, 'pickState')) ?? null;
}

/** Whether the puzzle is solved: its result says so, or the attempt does. */
export async function isPuzzleSolved(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const result = ui.get(Handles.chessPuzzleSummary);
  if (
    (await result.isVisible()) &&
    (await result.attribute('data-outcome')) === 'solved'
  )
    return true;
  return (await readPuzzleState(s, actorId)) === 'solved';
}

/** Until the attempt on the actor's board is in `state`. */
export async function waitPuzzleState(
  s: ProductHarness,
  actorId: string,
  state: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await readPuzzleState(s, actorId)) === state ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: `puzzle ${state}` }
  );
}

/** Until the help on the actor's board is `help`. */
export async function waitPuzzleHelp(
  s: ProductHarness,
  actorId: string,
  help: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await readPuzzleHelp(s, actorId)) === help ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: `help ${help}` }
  );
}

/** Until the solver may move: the attempt is live and the board takes moves. */
export async function waitSolverMayMove(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleProbe> {
  return pollUntil(
    s,
    async () => {
      const probe = await readPuzzleProbe(s, actorId);
      return probe?.status === 'solving' && probe.interactive ? probe : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the solver may move' }
  );
}

// --------------------------------------------------------------- the board

/** The board frame is laid out and the game's board is drawn inside it. */
async function boardReadyNow(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (!(await frame.isVisible())) return false;
  await frame.layout();
  const board = ui.get(PUZZLE_BOARD);
  if (!(await board.isVisible())) return false;
  await board.layout();
  return true;
}

/** A finished puzzle's result is what shows, in the board's place. */
async function resultShownNow(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleSummary).isVisible();
}

/** The puzzle's board is up, or the result of a puzzle already over. */
async function waitBoardReady(s: ProductHarness, actorId: string) {
  await pollUntil(
    s,
    async () =>
      (await resultShownNow(s, actorId)) || (await boardReadyNow(s, actorId))
        ? true
        : null,
    { maxMs: WAIT_MS, description: 'the puzzle board' }
  );
}

/** A board is up and the solver may move, or its puzzle is already over. */
async function waitBoardSettled(s: ProductHarness, actorId: string) {
  await waitBoardReady(s, actorId);
  try {
    await pollUntil(
      s,
      async () => {
        const probe = await readPuzzleProbe(s, actorId);
        return probe !== null &&
          (probe.interactive || probe.status !== 'solving')
          ? true
          : null;
      },
      { maxMs: INTERACTIVE_MS, stepMs: POLL_MS, description: 'board settled' }
    );
  } catch {
    // A watcher's board never takes the host's moves: it is settled as is.
  }
}

/**
 * The positions two people's puzzle boards show now, each brought into view
 * to be read (an opponent's automatic reply included).
 */
export async function readPuzzleBoardPair(
  s: ProductHarness,
  first: string,
  second: string
): Promise<{ readonly first: string | null; readonly second: string | null }> {
  await bringToFront(s, first);
  const firstPosition = await readPuzzleBoardPosition(s, first);
  await bringToFront(s, second);
  const secondPosition = await readPuzzleBoardPosition(s, second);
  return { first: firstPosition, second: secondPosition };
}

/** Whether the puzzles offer the way back to the game's choices. */
export async function isPuzzleExitOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.navBack).isVisible();
}

/** Whether the puzzle board's screen is the one on show. */
export async function isPuzzleScreenShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzlePlayScreen).isVisible();
}

/** The board says puzzles need a connection, in place of a puzzle. */
export async function isPuzzleOfflineNoticeShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleOffline).isVisible();
}

/** The feed has no puzzle to place: the board says so in its place. */
export async function isEmptyFeedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleEmptyPool).isVisible();
}

/** The empty feed says it is empty because nothing was ever failed. */
export async function isEmptyFeedForNoFailedAttempts(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (!(await isEmptyFeedShown(s, actorId))) return false;
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleEmptyPoolNoFailed).isVisible();
}

/** Press the empty feed's own action ("Include played puzzles"). */
export async function pressEmptyFeedAction(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await isEmptyFeedShown(s, actorId)) ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the empty feed' }
  );
  const ui = await actorUi(s, actorId);
  await ui
    .get(`${Handles.chessPuzzleEmptyPool}-action`)
    .tap({ timeoutMs: WAIT_MS });
}

/** The daily puzzle limit is shown in place of a puzzle. */
export async function isPuzzleLimitShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleLimit).isVisible();
}

/** The limit invites the person to sign in for more ("Sign in"). */
export async function isPuzzleLimitSignInOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (!(await isPuzzleLimitShown(s, actorId))) return false;
  const ui = await actorUi(s, actorId);
  const action = ui.get(`${Handles.chessPuzzleLimit}-action`);
  if (!(await action.isVisible())) return false;
  return (await action.text())?.trim() === 'Sign in';
}

// ----------------------------------------------------- in and out of puzzles

/**
 * Into `gameId`'s puzzles from the space: the game from the space's game
 * choice unless its choices are already shown, then Puzzle.
 */
async function openPuzzleChoice(
  s: ProductHarness,
  actorId: string,
  gameId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzlePlayScreen).isVisible()) return;
  if (!(await ui.get(Handles.gameChoice('puzzle')).isVisible())) {
    await ui.get(Handles.gameMenu(gameId)).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.gameChoice('puzzle'))
      .expect.visible({ timeoutMs: WAIT_MS });
  }
  await ui.get(Handles.gameChoice('puzzle')).tap({ timeoutMs: WAIT_MS });
}

/** Open `gameId`'s puzzles in the actor's space and wait for the board. */
export const openGamePuzzles = scenarioAction({
  name: 'openGamePuzzles',
  act: async (s, actorId: string, gameId: string) => {
    await waitActiveSpace(s, actorId);
    await openPuzzleChoice(s, actorId, gameId);
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.chessPuzzlePlayScreen)
      .expect.visible({ timeoutMs: WAIT_MS });
    await waitBoardSettled(s, actorId);
  },
});

/**
 * Open `gameId`'s puzzles without waiting for a board: offline with no
 * puzzle on the device, or with an empty feed, the screen says so instead.
 */
export const openGamePuzzlesNoWait = scenarioAction({
  name: 'openGamePuzzlesNoWait',
  act: (s, actorId: string, gameId: string) =>
    openPuzzleChoice(s, actorId, gameId),
});

/** Leave the puzzle for the game's choices, as the back control does. */
export const leavePuzzleForGameChoices = scenarioAction({
  name: 'leavePuzzleForGameChoices',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    // Back steps through the open places (a line, the settings) to the
    // stage's home, and from there out to the game's choices.
    await showPuzzleHome(s, actorId);
    await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.gameChoice('puzzle'))
      .expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Back onto the puzzles: from the game's choices through Puzzle, or one step
 * back from wherever an interruption (signing in) left the person; then the
 * board, or what the screen shows in its place (the limit, the offline
 * notice). An unfinished puzzle comes back as it was.
 */
export const goBackToGamePuzzles = scenarioAction({
  name: 'goBackToGamePuzzles',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (await ui.get(Handles.gameChoice('puzzle')).isVisible())
      await ui.get(Handles.gameChoice('puzzle')).tap({ timeoutMs: WAIT_MS });
    else if (!(await ui.get(Handles.chessPuzzlePlayScreen).isVisible()))
      await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.chessPuzzlePlayScreen)
      .expect.visible({ timeoutMs: WAIT_MS });
    const shown = await pollUntil(
      s,
      async () => {
        if (await isPuzzleLimitShown(s, actorId)) return 'notice';
        if (await isPuzzleOfflineNoticeShown(s, actorId)) return 'notice';
        if (await resultShownNow(s, actorId)) return 'board';
        return (await boardReadyNow(s, actorId)) ? 'board' : null;
      },
      { maxMs: WAIT_MS, description: 'the puzzles, or why not' }
    );
    if (shown === 'board') await waitBoardSettled(s, actorId);
  },
});

/**
 * Back to `gameId`'s puzzles in the space from wherever the person is in it
 * (another of the game's screens, its choices, or the space's game choice),
 * as they would make their way: back until the game's choices or the game,
 * then Puzzle. An unfinished puzzle comes back as it was.
 */
export const returnToGamePuzzles = scenarioAction({
  name: 'returnToGamePuzzles',
  act: async (s, actorId: string, gameId: string) => {
    const ui = await actorUi(s, actorId);
    await pollUntil(
      s,
      async () => {
        if (await ui.get(Handles.chessPuzzlePlayScreen).isVisible())
          return true;
        for (const way of [
          Handles.gameChoice('puzzle'),
          Handles.gameMenu(gameId),
          Handles.navBack,
        ])
          if (await ui.get(way).isVisible()) {
            await ui.get(way).tap({ timeoutMs: WAIT_MS });
            return null;
          }
        return null;
      },
      { maxMs: WAIT_MS, description: `${actorId} back at the puzzles` }
    );
    await waitBoardSettled(s, actorId);
  },
});

/** What each person in the space has in view, as the puzzle model names it. */
export type PuzzleView = 'Board' | 'GameChoices' | 'GameChoice' | 'Elsewhere';

export async function readPuzzleView(
  s: ProductHarness,
  actorId: string,
  gameId: string
): Promise<PuzzleView> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.chessPuzzlePlayScreen]))
    return 'Board';
  if (await visible(s, actorId, [Handles.gameChoice('puzzle')]))
    return 'GameChoices';
  if (await visible(s, actorId, [Handles.gameMenu(gameId)]))
    return 'GameChoice';
  return 'Elsewhere';
}

// ---------------------------------------------------------------- controls

/**
 * Press one of the attempt's controls. They are on the stage's home (the
 * board while solving); from another place (the line, the settings) the
 * person goes back there first.
 */
async function tapControl(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(handle).isVisible())) await showPuzzleHome(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: WAIT_MS });
}

/**
 * Leave a finished puzzle's result for its line on the board, by the
 * result's own row, when the result is what shows.
 */
export async function closeResultPanel(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(Handles.chessPuzzleSummary).isVisible())) return;
  await ui.get(Handles.chessPuzzleSummaryClose).tap({ timeoutMs: WAIT_MS });
  await ui
    .get(Handles.chessPuzzleSummary)
    .expect.hidden({ timeoutMs: WAIT_MS });
}

/**
 * The control that moves on to the next puzzle, where the person is: the
 * result's own, or the one under the finished puzzle's line.
 */
async function nextPuzzleControl(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  return (await ui.get(Handles.chessPuzzleSummaryNext).isVisible())
    ? Handles.chessPuzzleSummaryNext
    : Handles.chessPuzzleActionNext;
}

/**
 * The board, ready for a move: from the line or the settings of a puzzle
 * being solved, back to the board itself. Nothing to do when it shows, or
 * when the puzzle is over.
 */
export async function showPuzzleBoard(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const here = await readPuzzlePlace(s, actorId);
  if (here === null || here.stage !== 'playing' || here.place === 'play')
    return;
  await showPuzzleHome(s, actorId);
}

/** The first hint: where the solution move starts is highlighted. */
export const takePuzzleHint = scenarioAction({
  name: 'takePuzzleHint',
  act: async (s, actorId: string) => {
    await tapControl(s, actorId, Handles.chessPuzzleActionHint);
    await waitPuzzleHelp(s, actorId, 'highlight');
  },
});

/** The second hint: the solution move is shown. */
export const takeSecondPuzzleHint = scenarioAction({
  name: 'takeSecondPuzzleHint',
  act: async (s, actorId: string) => {
    await tapControl(s, actorId, Handles.chessPuzzleActionHint);
    await waitPuzzleHelp(s, actorId, 'solution');
  },
});

/** Show the solution: the rest of the line plays out and the puzzle is over. */
export const showPuzzleSolution = scenarioAction({
  name: 'showPuzzleSolution',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await showPuzzleBoard(s, actorId);
    // After a wrong move the bar has its own Solution control; while
    // solving, the one hint control goes on from the hints to the line.
    const solution = ui.get(Handles.chessPuzzleActionSolution);
    if (await solution.isVisible()) {
      await solution.tap({ timeoutMs: WAIT_MS });
    } else {
      const hint = ui.get(Handles.chessPuzzleActionHint);
      for (let press = 0; press < 3; press++) {
        if ((await readPuzzleState(s, actorId)) === 'revealed') break;
        await hint.tap({ timeoutMs: WAIT_MS });
      }
    }
    await waitPuzzleState(s, actorId, 'revealed');
  },
});

/** Give up on the puzzle. */
export const skipGamePuzzle = scenarioAction({
  name: 'skipGamePuzzle',
  act: async (s, actorId: string) => {
    await tapControl(s, actorId, Handles.chessPuzzleActionSkip);
    await waitPuzzleState(s, actorId, 'skipped');
  },
});

/** The same puzzle again, once the board offers a retry. */
export const retryGamePuzzle = scenarioAction({
  name: 'retryGamePuzzle',
  act: async (s, actorId: string) => {
    await closeResultPanel(s, actorId);
    await tapControl(s, actorId, Handles.chessPuzzleActionRetry);
    await waitPuzzleState(s, actorId, 'solving');
    await waitBoardSettled(s, actorId);
  },
});

/** Retry only if the board offers it; nothing to press otherwise. */
export const retryGamePuzzleIfOffered = scenarioAction({
  name: 'retryGamePuzzleIfOffered',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const retry = ui.get(Handles.chessPuzzleActionRetry);
    if (await retry.isVisible()) await retry.tap();
  },
});

/** Until a puzzle is placed on the board and has finished loading. */
export async function waitNextPuzzle(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () =>
      (await readPuzzleOnBoard(s, actorId)) !== null &&
      (await readPickField(s, actorId, 'loading')) === '0'
        ? true
        : null,
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the next puzzle' }
  );
  await waitBoardSettled(s, actorId);
}

/** Move on to the next puzzle and wait for it. */
export const moveOnToNextPuzzle = scenarioAction({
  name: 'moveOnToNextPuzzle',
  act: async (s, actorId: string) => {
    await tapControl(s, actorId, await nextPuzzleControl(s, actorId));
    await waitNextPuzzle(s, actorId);
  },
});

/** Move on, without waiting for a puzzle: the feed may have none left. */
export const moveOnWithoutWaiting = scenarioAction({
  name: 'moveOnWithoutWaiting',
  act: async (s, actorId: string) =>
    tapControl(s, actorId, await nextPuzzleControl(s, actorId)),
});

/** Ask for the next puzzle: press it only when the screen offers it. */
export const askForNextPuzzle = scenarioAction({
  name: 'askForNextPuzzle',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const next = ui.get(await nextPuzzleControl(s, actorId));
    if (await next.isVisible()) await next.tap({ timeoutMs: WAIT_MS });
  },
});

/**
 * The next puzzle asked for twice back to back: the result's own control
 * when it shows, else the one under the line; then whichever is still
 * there, pressed again.
 */
export const askForNextPuzzleTwice = scenarioAction({
  name: 'askForNextPuzzleTwice',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(await nextPuzzleControl(s, actorId))
      .tap({ timeoutMs: WAIT_MS });
    const again = ui.get(await nextPuzzleControl(s, actorId));
    if (await again.isVisible()) await again.tap({ timeoutMs: WAIT_MS });
    await waitNextPuzzle(s, actorId);
  },
});

/**
 * Look back one move of the line, or forward again toward the latest, on
 * the line's own place.
 */
export const stepThroughPuzzleLine = scenarioAction({
  name: 'stepThroughPuzzleLine',
  act: async (s, actorId: string, direction: 'back' | 'forward') => {
    await openPuzzleLine(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleMoveNav(direction)).tap();
    await s.session.waitForIdle();
  },
});

/** Choose a reached position: a recorded move, or the supplied solo position at zero. */
export const choosePuzzleLineMove = scenarioAction({
  name: 'choosePuzzleLineMove',
  act: async (s, actorId: string, move: number) => {
    if ((await readPuzzleProbe(s, actorId))?.solveIdx === move) return;
    await openPuzzleLine(s, actorId);
    const ui = await actorUi(s, actorId);
    const target =
      move === 0
        ? Handles.chessPuzzleMoveNav('start')
        : Handles.chessPuzzleMovePly(move - 1);
    await ui.get(target).tap({
      timeoutMs: WAIT_MS,
    });
    await s.session.waitForIdle();
  },
});

/** Set the puzzles to advance one second after a solve, in the feed settings. */
export const advancePuzzlesAfterASecond = scenarioAction({
  name: 'advancePuzzlesAfterASecond',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await openPuzzleFeed(s, actorId);
    await openFeedSetting(s, actorId, 'feed-advance');
    // The choice is applied and returns to the settings, where Done saves.
    await ui
      .get(Handles.chessPuzzleFeedAutoAdvanceSegment('after1s'))
      .tap({ timeoutMs: WAIT_MS });
    await waitPuzzleFeedHub(s, actorId);
    await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
    await waitPuzzleFeedClosed(s, actorId);
  },
});

/** Which of the attempt's controls the screen offers right now. */
export async function readPuzzleControls(s: ProductHarness, actorId: string) {
  const place = await readPuzzlePlace(s, actorId);
  return {
    retryOffered: await visible(s, actorId, [Handles.chessPuzzleActionRetry]),
    // Moving on is offered by the result, or under the finished line.
    moveOnOffered:
      (await visible(s, actorId, [Handles.chessPuzzleActionNext])) ||
      (await visible(s, actorId, [Handles.chessPuzzleSummaryNext])),
    resultMoveOnOffered: await visible(s, actorId, [
      Handles.chessPuzzleSummaryNext,
    ]),
    resultShown: await visible(s, actorId, [Handles.chessPuzzleSummary]),
    feedSettingsOpen:
      place !== null &&
      (place.place === 'feed' || place.place.startsWith('feed-')),
  };
}

// --------------------------------------------------------- what is shown

/** The prompt above the board ("Your turn — …"). */
export async function readPuzzlePrompt(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return stripProbe(await ui.get(Handles.chessPuzzleStatusLabel).text());
  } catch {
    return null;
  }
}

/**
 * A move's chip leads with its number when the turn has one (`41. Kh4`,
 * `4… g6`); the move itself, as the game writes it, is what follows.
 */
const MOVE_NUMBER = /^\d+(?:\.{1,3}|…)[\s\u00a0]+/;

/** The move a chip shows, without its number. */
export function moveChipText(text: string | null | undefined): string {
  return stripProbe(text).replace(MOVE_NUMBER, '');
}

/**
 * The move the move list highlights: its index from 0 and its text. The
 * board and the line show the moves; a result does not (`showPuzzleLine`
 * first).
 */
export async function readPuzzleHighlightedMove(
  s: ProductHarness,
  actorId: string
): Promise<{ readonly index: number; readonly text: string } | null> {
  const ui = await actorUi(s, actorId);
  const probe = ui.get(Handles.chessPuzzleMovePlySelected);
  if (!(await probe.isVisible())) return null;
  const index = Number.parseInt(stripProbe(await probe.text()), 10);
  if (!Number.isFinite(index)) return null;
  const chip = ui.get(Handles.chessPuzzleMovePly(index));
  return { index, text: moveChipText(await chip.text()) };
}

export type ShownRatingChange = 'raised' | 'lowered' | 'unchanged' | 'unrated';

/**
 * The rating change on screen, read off its signed number; null if none.
 * A finished puzzle's change is on its result (`showPuzzleResult` first,
 * from its line).
 */
export async function readShownRatingChange(
  s: ProductHarness,
  actorId: string
): Promise<ShownRatingChange | null> {
  const ui = await actorUi(s, actorId);
  for (const handle of [
    Handles.chessPuzzleSummaryDelta,
    Handles.chessPuzzleFeedRatingChange,
  ]) {
    const node = ui.get(handle);
    if (!(await node.isVisible())) continue;
    const text = stripProbe(await node.text());
    const match = /^([+\-−])?(\d+)$/.exec(text);
    if (match === null) return text.length > 0 ? 'unrated' : null;
    if (match[2] === '0') return 'unchanged';
    return match[1] === '+' ? 'raised' : 'lowered';
  }
  const unrated = ui.get(Handles.chessPuzzleFeedUnratedLabel);
  return (await unrated.isVisible()) ? 'unrated' : null;
}

/**
 * The puzzle on the board is marked unrated (a repeat): on the board's
 * status line while it is solved, on its result once it is over.
 */
export async function isPuzzleUnratedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleFeedUnratedLabel).isVisible();
}

/**
 * The puzzle's own rating shows. It is a fact of the result, hidden while
 * the puzzle is solved.
 */
export async function isPuzzleOwnRatingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleBoardElo);
  return (await node.isVisible()) && /\d/.test(stripProbe(await node.text()));
}

/** The puzzle's themes show: a fact of the result, as its own rating is. */
export async function isPuzzleThemesShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleFeedPuzzleThemes);
  return (await node.isVisible()) && stripProbe(await node.text()).length > 0;
}

/** The haptics the actor's device played, in order. */
export async function readDeviceHaptics(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  const env = await s.harness.client(actorId);
  return [...(env.haptics as RecordingHaptics).calls];
}

/**
 * Puzzle starts the actor has left today, when the puzzles show them: on
 * the settings row of a stage's home (and a watcher's board).
 */
export async function readPuzzleStartsLeft(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const node = ui.get('chess-puzzle-remaining-today');
  if (!(await node.isVisible())) return null;
  // Reconnecting can replace the allowance after it was seen: its absence
  // then is a normal loading state; any other failure is one.
  const text = await node.text().catch((error: unknown) => {
    if (error instanceof ElementNotFoundError) return null;
    throw error;
  });
  const match = text?.match(/^\s*(\d+)/);
  return match === null || match === undefined ? null : Number(match[1]);
}

/** Open the line's own place, where the moves are stepped through. */
export const showPuzzleLine = scenarioAction({
  name: 'showPuzzleLine',
  act: openPuzzleLine,
});

/**
 * Back to the home of the puzzles' stage: the board being solved, the
 * result of a finished puzzle, or why there is no puzzle.
 */
export const showPuzzleStageHome = scenarioAction({
  name: 'showPuzzleStageHome',
  act: async (s, actorId: string) => {
    await showPuzzleHome(s, actorId);
  },
});

export const PUZZLE_SCREEN_ACTIONS = [
  showPuzzleLine,
  showPuzzleStageHome,
  openGamePuzzles,
  openGamePuzzlesNoWait,
  moveOnWithoutWaiting,
  leavePuzzleForGameChoices,
  goBackToGamePuzzles,
  returnToGamePuzzles,
  takePuzzleHint,
  takeSecondPuzzleHint,
  showPuzzleSolution,
  skipGamePuzzle,
  retryGamePuzzle,
  retryGamePuzzleIfOffered,
  moveOnToNextPuzzle,
  askForNextPuzzle,
  askForNextPuzzleTwice,
  stepThroughPuzzleLine,
  choosePuzzleLineMove,
  advancePuzzlesAfterASecond,
];
