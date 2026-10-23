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

/** Whether the puzzle's result is shown: solved, its panel on the board. */
export async function isPuzzleSolved(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) return true;
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

async function waitBoardReady(s: ProductHarness, actorId: string) {
  await pollUntil(
    s,
    async () => ((await boardReadyNow(s, actorId)) ? true : null),
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
    // A result panel covers the board: it is closed first, as a person must.
    await closeResultPanel(s, actorId);
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

async function tapControl(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: WAIT_MS });
}

/** Close the result panel over a finished puzzle, when it is open. */
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
    await tapControl(s, actorId, Handles.chessPuzzleActionNext);
    await waitNextPuzzle(s, actorId);
  },
});

/** Move on, without waiting for a puzzle: the feed may have none left. */
export const moveOnWithoutWaiting = scenarioAction({
  name: 'moveOnWithoutWaiting',
  act: (s, actorId: string) =>
    tapControl(s, actorId, Handles.chessPuzzleActionNext),
});

/** Ask for the next puzzle: press it only when the board offers it. */
export const askForNextPuzzle = scenarioAction({
  name: 'askForNextPuzzle',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const next = ui.get(Handles.chessPuzzleActionNext);
    if (await next.isVisible()) await next.tap({ timeoutMs: WAIT_MS });
  },
});

/**
 * The next puzzle asked for twice back to back: the result panel's when it
 * shows, else the bar's, then the bar's again if it is still there.
 */
export const askForNextPuzzleTwice = scenarioAction({
  name: 'askForNextPuzzleTwice',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const summary = ui.get(Handles.chessPuzzleSummaryNext);
    const first = (await summary.isVisible())
      ? summary
      : ui.get(Handles.chessPuzzleActionNext);
    await first.tap({ timeoutMs: WAIT_MS });
    const again = ui.get(Handles.chessPuzzleActionNext);
    if (await again.isVisible()) await again.tap({ timeoutMs: WAIT_MS });
    await waitNextPuzzle(s, actorId);
  },
});

/** Look back one move of the line, or forward again toward the latest. */
export const stepThroughPuzzleLine = scenarioAction({
  name: 'stepThroughPuzzleLine',
  act: async (s, actorId: string, direction: 'back' | 'forward') => {
    await closeResultPanel(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui
      .get(
        direction === 'back'
          ? Handles.chessPuzzleActionBack
          : Handles.chessPuzzleActionForward
      )
      .tap();
    await s.session.waitForIdle();
  },
});

/** Choose a reached position: a recorded move, or the supplied solo position at zero. */
export const choosePuzzleLineMove = scenarioAction({
  name: 'choosePuzzleLineMove',
  act: async (s, actorId: string, move: number) => {
    await closeResultPanel(s, actorId);
    if ((await readPuzzleProbe(s, actorId))?.solveIdx === move) return;
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
    await ui.get(Handles.chessPuzzleFeedSummary).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.chessPuzzleFeedDone).expect.visible({
      timeoutMs: WAIT_MS,
    });
    await ui
      .get(Handles.chessPuzzleFeedAutoAdvanceSegment('after1s'))
      .tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.chessPuzzleFeedDone).expect.hidden({
      timeoutMs: WAIT_MS,
    });
  },
});

/** Which of the attempt's controls the board offers right now. */
export async function readPuzzleControls(s: ProductHarness, actorId: string) {
  return {
    retryOffered: await visible(s, actorId, [Handles.chessPuzzleActionRetry]),
    moveOnOffered: await visible(s, actorId, [Handles.chessPuzzleActionNext]),
    resultMoveOnOffered: await visible(s, actorId, [
      Handles.chessPuzzleSummaryNext,
    ]),
    resultShown: await visible(s, actorId, [Handles.chessPuzzleSummary]),
    feedSettingsOpen: await visible(s, actorId, [Handles.chessPuzzleFeedDone]),
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

/** The move the board's move list highlights: its index from 0 and its text. */
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
  return { index, text: stripProbe(await chip.text()) };
}

export type ShownRatingChange = 'raised' | 'lowered' | 'unchanged' | 'unrated';

/** The rating change on screen, read off its signed number; null if none. */
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

/** The feed marks the puzzle on the board unrated (a repeat). */
export async function isPuzzleUnratedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleFeedUnratedLabel).isVisible();
}

/** The puzzle's own rating shows: on the feed bar or the result panel. */
export async function isPuzzleOwnRatingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  for (const handle of [
    Handles.chessPuzzleBoardElo,
    Handles.chessPuzzleSummaryPuzzleRating,
  ]) {
    const node = ui.get(handle);
    if ((await node.isVisible()) && /\d/.test(stripProbe(await node.text())))
      return true;
  }
  return false;
}

/** The puzzle's themes show on the feed bar. */
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

/** Puzzle starts the actor has left today, when the board shows them. */
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

export const PUZZLE_SCREEN_ACTIONS = [
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
