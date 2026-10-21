/**
 * The feed choices `specs/games/puzzle-feed.qnt` names, each one kind of
 * feed setting, for any game offering puzzles: previewed through the feed
 * settings themselves, and read back from the feed bar's whole description
 * (as a screen reader hears it). "chosen theme" is the game's
 * {@link chosenFeedTheme}.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { HarnessGame } from './harness-game';
import { harnessGameOf } from './harness-game-of';
import type {
  FeedAutoAdvance,
  FeedHistoryFilter,
  FeedMode,
} from './puzzle-feed';
import {
  clearPuzzleFeedTheme,
  feedThemeLabel,
  feedThemesOf,
  setPuzzleFeedAutoAdvance,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
} from './puzzle-feed';
import { theKnownPuzzle } from './puzzle-moves';

type FeedChoice = {
  readonly mode: FeedMode;
  readonly offset: number;
  readonly target: number;
  readonly history: FeedHistoryFilter;
  readonly theme: boolean;
  readonly advance: FeedAutoAdvance;
};

const DEFAULT: FeedChoice = {
  mode: 'auto',
  offset: 0,
  target: 1500,
  history: 'neverSeen',
  theme: false,
  advance: 'off',
};

const CHOICES: Readonly<Record<string, FeedChoice>> = {
  'own rating': DEFAULT,
  harder: { ...DEFAULT, offset: 50, target: 1550 },
  'chosen rating': { ...DEFAULT, mode: 'custom', target: 1550 },
  'any history': { ...DEFAULT, history: 'any' },
  played: { ...DEFAULT, history: 'seen' },
  failed: { ...DEFAULT, history: 'failed' },
  'chosen theme': { ...DEFAULT, theme: true },
  'after one second': { ...DEFAULT, advance: 'after1s' },
  immediately: { ...DEFAULT, advance: 'immediate' },
};

const HISTORY_LABELS: Readonly<Record<FeedHistoryFilter, string>> = {
  neverSeen: 'Unseen',
  any: 'Any',
  seen: 'Seen',
  failed: 'Failed',
};

/**
 * "A theme of the game's known puzzle": the first theme of the game's
 * known puzzle that the game lets a feed be limited to.
 */
export function chosenFeedTheme(game: HarnessGame): string {
  const offered = feedThemesOf(game);
  const theme = theKnownPuzzle(game).record.themes.find((candidate) =>
    offered.includes(candidate)
  );
  if (theme === undefined)
    throw new Error(
      `${game.label}: its known puzzle has no theme a feed can be limited to`
    );
  return theme;
}

/** The saved feed choice the feed bar describes on `actor`'s device. */
export async function readSavedFeedChoice(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<string> {
  const ui = await actorUi(s, actor);
  await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
  const description = (
    (await ui.get('chess-puzzle-feed-description').text()) ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (description.length === 0)
    throw new Error('the feed description is unavailable');
  const mode = description.includes('Custom target') ? 'custom' : 'auto';
  const target = Number(description.match(/target (\d+)/)?.[1]);
  const history = description.match(/History: ([^.]+)\./)?.[1];
  const theme = description.match(/Themes: ([^.]+)\./)?.[1];
  const advance = description.includes('after one second')
    ? 'after1s'
    : description.includes('immediately')
      ? 'immediate'
      : 'off';
  const chosen = feedThemeLabel(
    harnessGameOf(s, gameId),
    chosenFeedTheme(harnessGameOf(s, gameId))
  );
  const matched = Object.entries(CHOICES).find(
    ([, choice]) =>
      choice.mode === mode &&
      choice.target === target &&
      HISTORY_LABELS[choice.history] === history &&
      (choice.theme ? chosen : 'All themes') === theme &&
      choice.advance === advance
  );
  if (matched === undefined)
    throw new Error(`unexpected feed description: ${description}`);
  return matched[0];
}

async function adjustStepper(
  s: ProductHarness,
  actor: string,
  args: { prefix: string; target: number }
) {
  const ui = await actorUi(s, actor);
  for (let presses = 0; presses < 20; presses++) {
    const value = Number(
      (await ui.get(`${args.prefix}-value`).text())?.replace(/[^0-9-]/g, '')
    );
    if (!Number.isFinite(value)) throw new Error('no stepper value');
    if (value === args.target) return;
    await ui
      .get(`${args.prefix}-${value < args.target ? 'increase' : 'decrease'}`)
      .tap();
  }
  throw new Error('the feed stepper did not reach its target');
}

/**
 * Set every kind of feed setting in the open settings to the choice `name`
 * makes of it, leaving it unsaved.
 */
export const previewPuzzleFeedChoice = scenarioAction({
  name: 'previewPuzzleFeedChoice',
  act: async (s, actor: string, gameId: string, name: string) => {
    const choice = CHOICES[name];
    if (choice === undefined) throw new Error(`no feed choice ${name}`);
    await Promise.resolve(setPuzzleFeedMode.act(s, actor, 'auto'));
    await adjustStepper(s, actor, {
      prefix: Handles.chessPuzzleFeedOffsetValue.replace(/-value$/, ''),
      target: choice.offset,
    });
    await Promise.resolve(setPuzzleFeedMode.act(s, actor, choice.mode));
    if (choice.mode === 'custom')
      await adjustStepper(s, actor, {
        prefix: Handles.chessPuzzleFeedCustomRatingValue.replace(/-value$/, ''),
        target: choice.target,
      });
    await Promise.resolve(setPuzzleFeedHistory.act(s, actor, choice.history));
    await Promise.resolve(
      setPuzzleFeedAutoAdvance.act(s, actor, choice.advance)
    );
    const theme = chosenFeedTheme(harnessGameOf(s, gameId));
    await Promise.resolve(
      (choice.theme ? setPuzzleFeedTheme : clearPuzzleFeedTheme).act(
        s,
        actor,
        gameId,
        theme
      )
    );
  },
});

export const PUZZLE_FEED_CHOICE_ACTIONS = [previewPuzzleFeedChoice];
