/**
 * Story-only fixtures for walking the puzzle screens' places: the feed
 * settings a story edits and the real place machine under a story, so a
 * play function crosses places as the app does. Production never imports
 * this module.
 */
import {
  DEFAULT_PUZZLE_FEED_CONFIG,
  type PuzzleFeedConfig,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { createComputed, createMemo, createSignal, on } from 'solid-js';
import { fn } from 'storybook/test';
import {
  PUZZLE_PLAY_PLACES,
  type PuzzlePlayPlace,
  type PuzzlePlayStage,
} from './puzzle-play-places';
import type { PuzzleFeedSettingsModel } from './puzzle-play-screen-model';

/** The themes a story's feed can be narrowed to, as a game names them. */
const STORY_THEMES = [
  'mate',
  'mateIn2',
  'opening',
  'sacrifice',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'endgame',
  'middlegame',
] as const;

const STORY_THEME_LABELS: Readonly<Record<string, string>> = {
  mate: 'Checkmate',
  mateIn2: 'Mate in 2',
  opening: 'Opening',
  sacrifice: 'Sacrifice',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered attack',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
};

/** The feed settings of a signed-in player with nothing changed yet. */
export const STORY_FEED: PuzzleFeedSettingsModel = {
  status: 'ready',
  saved: DEFAULT_PUZZLE_FEED_CONFIG,
  savedReady: true,
  savedTarget: 1500,
  draft: DEFAULT_PUZZLE_FEED_CONFIG,
  draftTarget: 1500,
  profileRating: 1500,
  matched: 1240,
  total: 3000,
  themes: {
    choices: STORY_THEMES,
    label: (theme) => STORY_THEME_LABELS[theme] ?? theme,
  },
  onChange: fn(),
  onDone: fn(),
};

/**
 * The place a story walks, on the real machine: it opens on the story's
 * `place` arg and follows what the view opens, so a play function can
 * cross places as the app does. Each open and back still reaches the
 * story's spies.
 */
export function useStoryPuzzlePlaces(args: {
  readonly stage: () => PuzzlePlayStage;
  readonly place: () => PuzzlePlayPlace;
  readonly onOpen: (place: PuzzlePlayPlace) => void;
  readonly onBack: () => void;
}): {
  readonly place: () => PuzzlePlayPlace;
  readonly onOpen: (place: PuzzlePlayPlace) => void;
  readonly onBack: () => void;
  readonly home: () => void;
} {
  const nav = useScreenPlace(PUZZLE_PLAY_PLACES, args.stage);
  createComputed(on(args.place, (place) => nav.open(place)));
  return {
    place: nav.place,
    onOpen: (place) => {
      args.onOpen(place);
      nav.open(place);
    },
    onBack: () => {
      args.onBack();
      nav.back();
    },
    home: nav.home,
  };
}

/**
 * The feed settings a story edits: the draft follows the choices made on
 * the settings' screens, Done saves it and returns to the stage's home.
 */
export function useStoryFeedSettings(
  feed: () => PuzzleFeedSettingsModel,
  home: () => void
): () => PuzzleFeedSettingsModel {
  const [edit, setEdit] = createSignal<Partial<PuzzleFeedConfig>>({});
  const [saved, setSaved] = createSignal<Partial<PuzzleFeedConfig>>({});
  return createMemo<PuzzleFeedSettingsModel>(() => {
    const draft = { ...feed().draft, ...saved(), ...edit() };
    return {
      ...feed(),
      saved: { ...feed().saved, ...saved() },
      draft,
      draftTarget:
        draft.mode === 'custom'
          ? draft.customRating
          : feed().profileRating + draft.autoOffset,
      onChange: (patch) => {
        feed().onChange(patch);
        setEdit((current) => ({ ...current, ...patch }));
      },
      onDone: () => {
        feed().onDone();
        setSaved((current) => ({ ...current, ...edit() }));
        setEdit({});
        home();
      },
    };
  });
}
