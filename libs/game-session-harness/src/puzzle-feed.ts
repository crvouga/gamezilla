/**
 * The puzzle feed as a solver customizes it, for any game offering puzzles:
 * the feed settings opened from the feed bar, their history filter, target
 * mode, rating offset and custom target steppers, the game's themes and
 * auto-advance, saved, discarded or closed — and what the bar and the
 * settings say. A theme is named as the game names it (its `themes`).
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import type { HarnessGame } from './harness-game';
import { harnessGameOf } from './harness-game-of';
import {
  isEmptyFeedShown,
  pressEmptyFeedAction,
  readPuzzleOnBoard,
  waitNextPuzzle,
} from './puzzle-screen';

const WAIT_MS = 15_000;
const SETTLE_MS = 20_000;
const POLL_MS = 250;

export type FeedHistoryFilter = 'any' | 'neverSeen' | 'seen' | 'failed';
export type FeedMode = 'auto' | 'custom';
export type FeedAutoAdvance = 'off' | 'after1s' | 'immediate';

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

/** How `game` names `theme` to a person. */
export function feedThemeLabel(game: HarnessGame, theme: string): string {
  const themes = game.client.puzzles?.themes;
  if (themes === undefined)
    throw new Error(`${game.label} offers no puzzle themes`);
  return themes.label(theme);
}

/** Every theme `game` lets a feed be limited to. */
export function feedThemesOf(game: HarnessGame): readonly string[] {
  return game.client.puzzles?.themes?.choices ?? [];
}

// ------------------------------------------------------------ the settings

/** Open the feed settings from the feed bar. */
export const openPuzzleFeedSettings = scenarioAction({
  name: 'openPuzzleFeedSettings',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleFeedSummary).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.chessPuzzleFeedDone).expect.visible({
      timeoutMs: WAIT_MS,
    });
  },
});

async function pressDone(s: ProductHarness, actorId: string): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedDone).expect.hidden({
    timeoutMs: WAIT_MS,
  });
}

/** Done saves the settings; a changed feed places its puzzle. */
export const closePuzzleFeedSettings = scenarioAction({
  name: 'closePuzzleFeedSettings',
  act: async (s, actorId: string) => {
    await pressDone(s, actorId);
    await waitNextPuzzle(s, actorId);
  },
});

/** Done without waiting for a board: the saved choices may fit no puzzle. */
export const closePuzzleFeedSettingsNoWait = scenarioAction({
  name: 'closePuzzleFeedSettingsNoWait',
  act: pressDone,
});

/**
 * Done saves the settings; wait for what the feed comes to — a puzzle on
 * the board, or the empty feed when the saved choices fit no puzzle.
 */
export const savePuzzleFeedSettings = scenarioAction({
  name: 'savePuzzleFeedSettings',
  act: async (s, actorId: string) => {
    await pressDone(s, actorId);
    await pollUntil(
      s,
      async () =>
        (await isEmptyFeedShown(s, actorId)) ||
        (await readPuzzleOnBoard(s, actorId)) !== null
          ? true
          : null,
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'the feed settled' }
    );
    if (!(await isEmptyFeedShown(s, actorId))) await waitNextPuzzle(s, actorId);
  },
});

/** Close the settings without saving, as Escape does. */
export const discardFeedSettings = scenarioAction({
  name: 'discardFeedSettings',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.key('escape');
    await ui
      .get(Handles.chessPuzzleFeedDone)
      .expect.hidden({ timeoutMs: WAIT_MS });
  },
});

export const setPuzzleFeedHistory = scenarioAction({
  name: 'setPuzzleFeedHistory',
  act: async (s, actorId: string, filter: FeedHistoryFilter) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.chessPuzzleFeedHistorySegment(filter))
      .tap({ timeoutMs: WAIT_MS });
  },
});

export const setPuzzleFeedMode = scenarioAction({
  name: 'setPuzzleFeedMode',
  act: async (s, actorId: string, mode: FeedMode) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.chessPuzzleFeedModeSegment(mode))
      .tap({ timeoutMs: WAIT_MS });
  },
});

export const setPuzzleFeedAutoAdvance = scenarioAction({
  name: 'setPuzzleFeedAutoAdvance',
  act: async (s, actorId: string, setting: FeedAutoAdvance) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.chessPuzzleFeedAutoAdvanceSegment(setting))
      .tap({ timeoutMs: WAIT_MS });
  },
});

/** Whether `theme` is chosen in the open themes picker. */
async function isThemeChosen(
  s: ProductHarness,
  actorId: string,
  theme: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const html = (await ui.snapshotHtml()) ?? '';
  const option = Handles.chessPuzzleFeedThemeOption(theme);
  // The option row, not the chip a chosen theme also shows.
  const rows = [
    ...html.matchAll(new RegExp(`<[^>]*data-testid="${option}"[^>]*>`, 'g')),
  ]
    .map((match) => match[0])
    .filter((tag) => tag.includes('aria-selected='));
  if (rows.length === 0) throw new Error(`the theme ${theme} is not on offer`);
  return rows.some((tag) => tag.includes('aria-selected="true"'));
}

/**
 * Make `theme` chosen or not in the themes picker: searched by the label
 * the game gives it, so its row shows, then the picker closed.
 */
async function pickFeedTheme(
  s: ProductHarness,
  actorId: string,
  pick: { readonly gameId: string; readonly theme: string; chosen: boolean }
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedThemeTrigger).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeSearch).clear();
  await ui
    .get(Handles.chessPuzzleFeedThemeSearch)
    .input(feedThemeLabel(harnessGameOf(s, pick.gameId), pick.theme));
  if ((await isThemeChosen(s, actorId, pick.theme)) !== pick.chosen)
    await ui
      .get(Handles.chessPuzzleFeedThemeOption(pick.theme))
      .tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeDone).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeDone).expect.hidden({
    timeoutMs: WAIT_MS,
  });
}

/** Choose `gameId`'s theme `theme` in the open feed settings. */
export const setPuzzleFeedTheme = scenarioAction({
  name: 'setPuzzleFeedTheme',
  act: (s, actorId: string, gameId: string, theme: string) =>
    pickFeedTheme(s, actorId, { gameId, theme, chosen: true }),
});

/** Unchoose `gameId`'s theme `theme` in the open feed settings. */
export const clearPuzzleFeedTheme = scenarioAction({
  name: 'clearPuzzleFeedTheme',
  act: (s, actorId: string, gameId: string, theme: string) =>
    pickFeedTheme(s, actorId, { gameId, theme, chosen: false }),
});

async function tapTimes(
  s: ProductHarness,
  actorId: string,
  handle: string,
  steps: number
): Promise<void> {
  const ui = await actorUi(s, actorId);
  for (let i = 0; i < steps; i += 1)
    await ui.get(handle).tap({ timeoutMs: WAIT_MS });
}

/** Press the rating offset's "+" `steps` times. */
export const raisePuzzleFeedOffset = scenarioAction({
  name: 'raisePuzzleFeedOffset',
  act: (s, actorId: string, steps: number) =>
    tapTimes(s, actorId, Handles.chessPuzzleFeedOffsetIncrease, steps),
});

/** Press the rating offset's "−" `steps` times. */
export const lowerPuzzleFeedOffset = scenarioAction({
  name: 'lowerPuzzleFeedOffset',
  act: (s, actorId: string, steps: number) =>
    tapTimes(s, actorId, Handles.chessPuzzleFeedOffsetDecrease, steps),
});

/** Press the custom target's "+" `steps` times. */
export const raisePuzzleFeedCustomTarget = scenarioAction({
  name: 'raisePuzzleFeedCustomTarget',
  act: (s, actorId: string, steps: number) =>
    tapTimes(s, actorId, Handles.chessPuzzleFeedCustomRatingIncrease, steps),
});

/** Press the custom target's "−" `steps` times. */
export const lowerPuzzleFeedCustomTarget = scenarioAction({
  name: 'lowerPuzzleFeedCustomTarget',
  act: (s, actorId: string, steps: number) =>
    tapTimes(s, actorId, Handles.chessPuzzleFeedCustomRatingDecrease, steps),
});

/** The empty feed's own action (include played puzzles), then its puzzle. */
export const includePlayedPuzzles = scenarioAction({
  name: 'includePlayedPuzzles',
  act: async (s, actorId: string) => {
    await pressEmptyFeedAction(s, actorId);
    await waitNextPuzzle(s, actorId);
  },
});

// ------------------------------------------------------------------- reads

export async function readFeedOffsetValue(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedOffsetValue).text()
  );
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * The target the open settings preview: the custom target's value in
 * custom mode, else the target under the rating offset.
 */
export async function readFeedModalTargetRating(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const custom = ui.get(Handles.chessPuzzleFeedCustomRatingValue);
  const raw = stripProbe(
    await ((await custom.isVisible())
      ? custom.text()
      : ui.get(Handles.chessPuzzleFeedTarget).text())
  );
  const match = /(\d{3,4})\s*$/.exec(raw);
  return match?.[1] !== undefined ? Number.parseInt(match[1], 10) : null;
}

/** How many puzzles fit the open settings, of how many: `{ matched, total }`. */
export async function readFeedModalPool(
  s: ProductHarness,
  actorId: string
): Promise<{ matched: number; total: number } | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(await ui.get(Handles.chessPuzzleFeedPool).text());
  const [matched, total] = raw.match(/\d+/g) ?? [];
  if (matched === undefined || total === undefined) return null;
  return {
    matched: Number.parseInt(matched, 10),
    total: Number.parseInt(total, 10),
  };
}

/** The feed bar's target: "Auto · 1500" / "Custom · 1550". */
export async function readFeedTargetLabel(
  s: ProductHarness,
  actorId: string
): Promise<{ mode: FeedMode; rating: number } | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedTargetLabel).text()
  );
  const match = /^(Auto|Custom)\s*·\s*(\d{3,4})$/.exec(raw);
  const rating = match?.[2];
  if (match === null || rating === undefined) return null;
  return {
    mode: match[1] === 'Auto' ? 'auto' : 'custom',
    rating: Number.parseInt(rating, 10),
  };
}

/** The feed bar's history filter, as it reads ("Unseen", "Any", …). */
export async function readFeedHistoryLabel(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedHistoryLabel).text()
  );
  return raw.length > 0 ? raw : null;
}

/** The feed bar names `theme` as the one theme the feed is limited to. */
export async function isFeedLimitedToTheme(
  s: ProductHarness,
  actorId: string,
  gameId: string,
  theme: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedThemesLabel).text()
  );
  return raw === feedThemeLabel(harnessGameOf(s, gameId), theme);
}

/**
 * The feed settings invite the person to sign in instead of offering the
 * feed choices (a guest cannot customize the feed): the invitation shows,
 * its call to action reads "Sign in", and no choice is on offer.
 */
export async function isFeedSignInInviteVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(Handles.chessPuzzleFeedLocked).isVisible())) return false;
  if (await ui.get(Handles.chessPuzzleFeedPool).isVisible()) return false;
  const action = ui.get(`${Handles.chessPuzzleFeedLocked}-action`);
  if (!(await action.isVisible())) return false;
  return (await action.text())?.trim() === 'Sign in';
}

export const PUZZLE_FEED_ACTIONS = [
  openPuzzleFeedSettings,
  closePuzzleFeedSettings,
  closePuzzleFeedSettingsNoWait,
  savePuzzleFeedSettings,
  discardFeedSettings,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedAutoAdvance,
  setPuzzleFeedTheme,
  clearPuzzleFeedTheme,
  raisePuzzleFeedOffset,
  lowerPuzzleFeedOffset,
  raisePuzzleFeedCustomTarget,
  lowerPuzzleFeedCustomTarget,
  includePlayedPuzzles,
];
