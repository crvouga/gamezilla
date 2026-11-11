/**
 * The puzzle feed as a solver customizes it, for any game offering puzzles:
 * the feed settings opened from the settings row, each setting on a place
 * of its own behind its row (the history filter, the target's mode with
 * its rating offset and custom target steppers, the game's themes and
 * what follows a solve), saved by Done or dropped by going back — and what
 * the settings row and the settings say. A theme is named as the game
 * names it (its `themes`).
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { TurnHarnessGame } from './harness-game';
import { turnHarnessGameOf } from './harness-game-of';
import {
  FEED_SETTING_ROW,
  type FeedSettingPlace,
  leavePuzzleFeedUnsaved,
  openFeedSetting,
  openPuzzleFeed,
  waitPuzzleFeedClosed,
  waitPuzzleFeedHub,
} from './puzzle-places';
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
export function feedThemeLabel(game: TurnHarnessGame, theme: string): string {
  const themes = game.client.puzzles?.themes;
  if (themes === undefined)
    throw new Error(`${game.label} offers no puzzle themes`);
  return themes.label(theme);
}

/** Every theme `game` lets a feed be limited to. */
export function feedThemesOf(game: TurnHarnessGame): readonly string[] {
  return game.client.puzzles?.themes?.choices ?? [];
}

// ------------------------------------------------------------ the settings

/** Open the feed settings from the settings row. */
export const openPuzzleFeedSettings = scenarioAction({
  name: 'openPuzzleFeedSettings',
  act: openPuzzleFeed,
});

/** Done is on the feed settings themselves: back there from a setting first. */
async function pressDone(s: ProductHarness, actorId: string): Promise<void> {
  await openPuzzleFeed(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
  await waitPuzzleFeedClosed(s, actorId);
}

/**
 * A setting's own place, then one of its choices: the choice is applied to
 * the draft and the place returns to the feed settings.
 */
async function chooseOnSetting(
  s: ProductHarness,
  actorId: string,
  choice: { readonly setting: FeedSettingPlace; readonly handle: string }
): Promise<void> {
  await openFeedSetting(s, actorId, choice.setting);
  const ui = await actorUi(s, actorId);
  await ui.get(choice.handle).tap({ timeoutMs: WAIT_MS });
  await waitPuzzleFeedHub(s, actorId);
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

/** Leave the settings without saving, as going back from them does. */
export const discardFeedSettings = scenarioAction({
  name: 'discardFeedSettings',
  act: leavePuzzleFeedUnsaved,
});

export const setPuzzleFeedHistory = scenarioAction({
  name: 'setPuzzleFeedHistory',
  act: (s, actorId: string, filter: FeedHistoryFilter) =>
    chooseOnSetting(s, actorId, {
      setting: 'feed-history',
      handle: Handles.chessPuzzleFeedHistorySegment(filter),
    }),
});

/** The target's mode, on the target's own place; the steppers follow it there. */
export const setPuzzleFeedMode = scenarioAction({
  name: 'setPuzzleFeedMode',
  act: async (s, actorId: string, mode: FeedMode) => {
    await openFeedSetting(s, actorId, 'feed-target');
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.chessPuzzleFeedModeSegment(mode))
      .tap({ timeoutMs: WAIT_MS });
  },
});

export const setPuzzleFeedAutoAdvance = scenarioAction({
  name: 'setPuzzleFeedAutoAdvance',
  act: (s, actorId: string, setting: FeedAutoAdvance) =>
    chooseOnSetting(s, actorId, {
      setting: 'feed-advance',
      handle: Handles.chessPuzzleFeedAutoAdvanceSegment(setting),
    }),
});

/** Whether `theme` is chosen on the themes' place: its toggle is pressed. */
async function isThemeChosen(
  s: ProductHarness,
  actorId: string,
  theme: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const option = ui.get(Handles.chessPuzzleFeedThemeOption(theme));
  await option.expect.visible({
    timeoutMs: WAIT_MS,
    description: `the theme ${theme} on offer`,
  });
  const pressed = await option.attribute('aria-pressed');
  if (pressed === null) throw new Error(`the theme ${theme} is not a choice`);
  return pressed === 'true';
}

/**
 * Make `theme` chosen or not on the themes' place: searched by the label
 * the game gives it, so it shows, then back to the feed settings.
 */
async function pickFeedTheme(
  s: ProductHarness,
  actorId: string,
  pick: { readonly gameId: string; readonly theme: string; chosen: boolean }
): Promise<void> {
  await openFeedSetting(s, actorId, 'feed-themes');
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedThemeSearch).clear();
  await ui
    .get(Handles.chessPuzzleFeedThemeSearch)
    .input(feedThemeLabel(turnHarnessGameOf(s, pick.gameId), pick.theme));
  if ((await isThemeChosen(s, actorId, pick.theme)) !== pick.chosen)
    await ui
      .get(Handles.chessPuzzleFeedThemeOption(pick.theme))
      .tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeDone).tap({ timeoutMs: WAIT_MS });
  await waitPuzzleFeedHub(s, actorId);
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

/** Press one of the target's steppers `steps` times, on the target's place. */
async function tapTimes(
  s: ProductHarness,
  actorId: string,
  handle: string,
  steps: number
): Promise<void> {
  await openFeedSetting(s, actorId, 'feed-target');
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

/** The rating offset on the target's own place (`setPuzzleFeedMode` opens it). */
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
 * The target the unsaved settings preview, where the person is: on the
 * target's own place the custom target's value or the target under the
 * rating offset; on the feed settings the target row's value.
 */
export async function readFeedModalTargetRating(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  for (const handle of [
    Handles.chessPuzzleFeedCustomRatingValue,
    Handles.chessPuzzleFeedTarget,
    FEED_SETTING_ROW['feed-target'],
  ]) {
    const node = ui.get(handle);
    if (!(await node.isVisible())) continue;
    const match = /(\d{3,4})\s*$/.exec(stripProbe(await node.text()));
    return match?.[1] !== undefined ? Number.parseInt(match[1], 10) : null;
  }
  return null;
}

/**
 * How many puzzles fit the unsaved settings, of how many: the pool line of
 * the feed settings themselves.
 */
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

/** The settings row's target: "Auto target 1500" / "Custom target 1550". */
export async function readFeedTargetLabel(
  s: ProductHarness,
  actorId: string
): Promise<{ mode: FeedMode; rating: number } | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedTargetLabel).text()
  );
  const match = /^(Auto|Custom) target\s*(\d{3,4})$/.exec(raw);
  const rating = match?.[2];
  if (match === null || rating === undefined) return null;
  return {
    mode: match[1] === 'Auto' ? 'auto' : 'custom',
    rating: Number.parseInt(rating, 10),
  };
}

/** The settings row's history filter, as it reads ("Unseen", "Any", …). */
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

/** The settings row names `theme` as the one theme the feed is limited to. */
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
  return raw === feedThemeLabel(turnHarnessGameOf(s, gameId), theme);
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
