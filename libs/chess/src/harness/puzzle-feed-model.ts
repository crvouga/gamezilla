import { actorUi, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { Handles } from '@libs/test-ids';
import {
  type FeedAutoAdvance,
  type FeedHistoryFilter,
  type FeedMode,
  selectFeedAutoAdvance,
  selectFeedHistory,
  selectFeedMode,
} from './chess-puzzle-feed-ui';

type Choice = {
  mode: FeedMode;
  offset: number;
  target: number;
  history: FeedHistoryFilter;
  theme: boolean;
  advance: FeedAutoAdvance;
};
const DEFAULT: Choice = {
  mode: 'auto',
  offset: 0,
  target: 1500,
  history: 'neverSeen',
  theme: false,
  advance: 'off',
};
const CHOICES: Readonly<Record<string, Choice>> = {
  'own rating': DEFAULT,
  harder: { ...DEFAULT, offset: 50, target: 1550 },
  'chosen rating': { ...DEFAULT, mode: 'custom', target: 1550 },
  'any history': { ...DEFAULT, history: 'any' },
  played: { ...DEFAULT, history: 'seen' },
  failed: { ...DEFAULT, history: 'failed' },
  'mate in two': { ...DEFAULT, theme: true },
  'after one second': { ...DEFAULT, advance: 'after1s' },
  immediately: { ...DEFAULT, advance: 'immediate' },
};

/** Reads the same complete description exposed to a screen reader. */
export async function readSavedFeedChoice(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const ui = await actorUi(s, actor);
  await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
  const html = await ui.snapshotHtml();
  const tag =
    html?.match(/<[^>]*data-testid="chess-puzzle-feed-summary"[^>]*>/)?.[0] ??
    '';
  const description = tag.match(/aria-label="([^"]*)"/)?.[1] ?? '';
  if (description.length === 0)
    throw new Error('Feed description is unavailable');
  const mode = description.includes('Custom target') ? 'custom' : 'auto';
  const target = Number(description.match(/target (\d+)/)?.[1]);
  const history = description.match(/History: ([^.]+)\./)?.[1];
  const theme = description.match(/Themes: ([^.]+)\./)?.[1];
  const advance = description.includes('after one second')
    ? 'after1s'
    : description.includes('immediately')
      ? 'immediate'
      : 'off';
  const matched = Object.entries(CHOICES).find(
    ([, choice]) =>
      choice.mode === mode &&
      choice.target === target &&
      { neverSeen: 'Unseen', any: 'Any', seen: 'Seen', failed: 'Failed' }[
        choice.history
      ] === history &&
      (choice.theme ? 'Mate in 2' : 'All themes') === theme &&
      choice.advance === advance
  );
  if (matched === undefined)
    throw new Error(`Unexpected feed description: ${description}`);
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
    if (!Number.isFinite(value)) throw new Error('No stepper value');
    if (value === args.target) return;
    await ui
      .get(`${args.prefix}-${value < args.target ? 'increase' : 'decrease'}`)
      .tap();
  }
  throw new Error('Feed stepper did not reach its target');
}

async function selectMateTheme(
  s: ProductHarness,
  actor: string,
  selected: boolean
) {
  const ui = await actorUi(s, actor);
  await ui.get(Handles.chessPuzzleFeedThemeTrigger).tap();
  await ui.get(Handles.chessPuzzleFeedThemeSearch).clear();
  await ui.get(Handles.chessPuzzleFeedThemeSearch).input('Mate in 2');
  const html = await ui.snapshotHtml();
  const tag = html?.match(
    /<[^>]*data-testid="chess-puzzle-feed-theme-mateIn2"[^>]*>/
  )?.[0];
  if (tag === undefined) throw new Error('Mate-in-two theme not available');
  if (tag.includes('aria-selected="true"') !== selected)
    await ui.get(Handles.chessPuzzleFeedThemeOption('mateIn2')).tap();
  await ui.get(Handles.chessPuzzleFeedThemeDone).tap();
}

/** Choose all relevant values through the actual editor, leaving the draft unsaved. */
export const previewPuzzleFeedChoice = scenarioAction({
  name: 'previewPuzzleFeedChoice',
  act: async (s, actor: string, name: string) => {
    const choice = CHOICES[name];
    if (choice === undefined) throw new Error(`Unknown feed choice: ${name}`);
    await selectFeedMode(s, actor, 'auto');
    await adjustStepper(s, actor, {
      prefix: 'chess-puzzle-feed-offset',
      target: choice.offset,
    });
    await selectFeedMode(s, actor, choice.mode);
    if (choice.mode === 'custom')
      await adjustStepper(s, actor, {
        prefix: 'chess-puzzle-feed-custom-rating',
        target: choice.target,
      });
    await selectFeedHistory(s, actor, choice.history);
    await selectFeedAutoAdvance(s, actor, choice.advance);
    await selectMateTheme(s, actor, choice.theme);
  },
});
