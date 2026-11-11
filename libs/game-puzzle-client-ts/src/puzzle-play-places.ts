/**
 * The puzzle feed's small screens and the machine that says which is shown
 * (`GAME_SCREENS.md`): the stage comes from the feed's pick and the attempt
 * on the board, the place from what this device opened.
 */

import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import {
  defineScreenPlaces,
  type ScreenPlaces,
} from '@pkgs/turn-game-client-ts/screen-places';

/**
 * Where the feed stands: a pick is pending (`loading`), no puzzle can be
 * placed (`offline`, the rated limit `limited`, an exhausted feed `empty`,
 * a watcher whose host has started none `waiting`), a puzzle is on the
 * board (`playing`), or the solver's puzzle is over (`finished`).
 */
export type PuzzlePlayStage =
  | 'loading'
  | 'offline'
  | 'limited'
  | 'empty'
  | 'waiting'
  | 'playing'
  | 'finished';

/** What the feed's pick came to: a placed puzzle, or why there is none. */
export type PuzzlePlayPick = Exclude<PuzzlePlayStage, 'finished'>;

/** One setting of the feed, each on a screen of its own. */
export type PuzzleFeedSettingScreen =
  | 'feed-target'
  | 'feed-history'
  | 'feed-themes'
  | 'feed-advance';

/**
 * `status`: why there is no puzzle; `play`: solve it on the board; `line`:
 * step through the moves played; `result`: how it went and what next;
 * `feed`: what the feed serves, one row per setting; `feed-…`: one setting.
 */
export type PuzzlePlayPlace = {
  readonly screen:
    | 'status'
    | 'play'
    | 'line'
    | 'result'
    | 'feed'
    | PuzzleFeedSettingScreen;
};

/** The feed settings: the hub and the screen of each setting. */
export const PUZZLE_FEED_SCREENS = [
  'feed',
  'feed-target',
  'feed-history',
  'feed-themes',
  'feed-advance',
] as const satisfies readonly PuzzlePlayPlace['screen'][];

const STATUS: PuzzlePlayPlace = { screen: 'status' };
const WITHOUT_PUZZLE = ['status', ...PUZZLE_FEED_SCREENS] as const;

/** Whether `place` is one of the feed settings' screens. */
export function isPuzzleFeedPlace(place: PuzzlePlayPlace): boolean {
  return PUZZLE_FEED_SCREENS.some((screen) => screen === place.screen);
}

/**
 * The feed's places. A watcher waiting for the host has nothing to set; the
 * line is stepped through from the board or from the result.
 */
export const PUZZLE_PLAY_PLACES: ScreenPlaces<PuzzlePlayStage, PuzzlePlayPlace> =
  defineScreenPlaces<PuzzlePlayStage, PuzzlePlayPlace>({
    home: {
      loading: STATUS,
      offline: STATUS,
      limited: STATUS,
      empty: STATUS,
      waiting: STATUS,
      playing: { screen: 'play' },
      finished: { screen: 'result' },
    },
    screens: {
      loading: WITHOUT_PUZZLE,
      offline: WITHOUT_PUZZLE,
      limited: WITHOUT_PUZZLE,
      empty: WITHOUT_PUZZLE,
      waiting: ['status'],
      playing: ['play', 'line', ...PUZZLE_FEED_SCREENS],
      finished: ['result', 'line', ...PUZZLE_FEED_SCREENS],
    },
    // One setting leads back to the settings; everything else to the home.
    parent: (place) =>
      place.screen !== 'feed' && isPuzzleFeedPlace(place)
        ? { screen: 'feed' }
        : null,
  });

/** Solved, the solution shown or skipped: nothing more to play on it. */
export function isPuzzleOver(status: SolveStatus): boolean {
  return status === 'solved' || status === 'revealed' || status === 'skipped';
}

/**
 * The feed's stage, from the data alone: the pick, then the attempt. A
 * watcher's board stays `playing` when the host's puzzle is over: the
 * result is the solver's.
 */
export function puzzlePlayStageOf(args: {
  readonly pick: PuzzlePlayPick;
  readonly status: SolveStatus;
  readonly spectator: boolean;
}): PuzzlePlayStage {
  if (args.pick !== 'playing') return args.pick;
  return !args.spectator && isPuzzleOver(args.status) ? 'finished' : 'playing';
}
