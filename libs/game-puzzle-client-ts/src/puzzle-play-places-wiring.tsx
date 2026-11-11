import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { t } from '@lingui/core/macro';
import { placeBehind } from '@pkgs/turn-game-client-ts/screen-places';
import {
  type ScreenPlaceNavigation,
  useScreenPlace,
} from '@pkgs/turn-game-client-ts/use-screen-place';
import { type Accessor, createMemo, type JSX } from 'solid-js';
import {
  isPuzzleFeedPlace,
  PUZZLE_PLAY_PLACES,
  type PuzzlePlayPlace,
  type PuzzlePlayStage,
} from './puzzle-play-places';
import type {
  PuzzleFeedSettingsModel,
  PuzzleLineModel,
  PuzzleResultModel,
} from './puzzle-play-screen-model';
import { usePuzzleFeedSettings } from './use-puzzle-feed-settings';

const noop = (): void => {};

/** The line of a board with no puzzle on it. */
export const NO_PUZZLE_LINE: PuzzleLineModel = {
  plies: [],
  selectedSolveIdx: 0,
  interactive: false,
  awaiting: false,
  writing: {
    notation: () => '',
    format: (label) => label,
    moveNumber: () => null,
  },
  nav: { canGoBack: false, canGoForward: false, onNavigate: noop },
  onSeek: noop,
};

/** The result of a board with no puzzle on it. */
export const NO_PUZZLE_RESULT: PuzzleResultModel = {
  completion: null,
  displayRating: 0,
  provisional: false,
  puzzleRating: 0,
  themes: [],
};

/** The feed's place on this device, and what its screens need of it. */
export type PuzzlePlayPlacesWiring = {
  readonly stage: Accessor<PuzzlePlayStage>;
  readonly nav: ScreenPlaceNavigation<PuzzlePlayPlace>;
  /** One step back; from the stage's home, out to the game's choices. */
  readonly back: () => void;
  readonly feed: Accessor<PuzzleFeedSettingsModel>;
};

/**
 * The feed's place machine on this device: the place within `stage`, the
 * feed settings its `feed-…` screens edit (a draft kept while any of them
 * shows), and Back. The move the board is on is the room's: leaving the
 * line keeps it, and the board says so until the person returns to the
 * latest move.
 */
export function usePuzzlePlayPlaces(args: {
  readonly stage: Accessor<PuzzlePlayStage>;
  /** Leave the puzzles for the game's choices. */
  readonly leave: () => void;
  readonly onFeedConfigApplied: () => void;
}): PuzzlePlayPlacesWiring {
  const nav = useScreenPlace(PUZZLE_PLAY_PLACES, args.stage);
  const editing = createMemo(() => isPuzzleFeedPlace(nav.place()));
  const feed = usePuzzleFeedSettings({
    editing,
    onApplied: args.onFeedConfigApplied,
    onClose: nav.home,
  });
  const back = (): void => {
    if (!nav.back()) args.leave();
  };
  return { stage: args.stage, nav, back, feed };
}

/**
 * The template's one back control: a step back through the places, named
 * for where it leads; from the stage's home, out to the game's choices.
 */
export function PuzzlePlaceBack(props: {
  readonly places: PuzzlePlayPlacesWiring;
}): JSX.Element {
  const choices = useGameChoicesName();
  const label = (): string | undefined => {
    const behind = placeBehind(
      PUZZLE_PLAY_PLACES,
      props.places.stage(),
      props.places.nav.place()
    );
    if (behind === null) return choices();
    return behind.screen === 'feed' ? t`Puzzle settings` : t`Puzzles`;
  };
  return <DefineBackButton onPress={props.places.back} label={label()} />;
}
