import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';

/**
 * Where finding an opponent stands, read from the search and the game the
 * space's host holds. Nobody navigates a stage: it changes when they do.
 *
 * - `loading`: still reading them.
 * - `unavailable`: a watcher in a space whose host has no game.
 * - `denied`: the person may not see this space's game or search.
 * - `idle`: nothing under way; the person may find an opponent.
 * - `searching`: a search is waiting for an opponent.
 * - `setup`: a matched game is waiting for its private setups.
 * - `playing`: a matched game is unfinished.
 * - `finished`: the matched game is over, or was aborted.
 */
export type MultiplayerStage =
  | 'loading'
  | 'unavailable'
  | 'denied'
  | 'idle'
  | 'searching'
  | 'setup'
  | 'playing'
  | 'finished';

/** The small screen this device shows within a stage. */
export type MultiplayerPlace = {
  readonly screen:
    | 'status'
    | 'find'
    | 'time-control'
    | 'ratings'
    | 'guide'
    | 'searching'
    | 'private-setup'
    | 'play'
    | 'commands'
    | 'moves'
    | 'result';
};

/** The matched game, as far as its stage needs it. */
export type MultiplayerStandingGame = {
  /** Unfinished: neither won, drawn nor aborted. */
  readonly ongoing: boolean;
  /** It has private setups and still waits for one of them. */
  readonly awaitingSetups: boolean;
};

/** What the stage is derived from. */
export type MultiplayerStanding = {
  /** The person may not see this space's game or search. */
  readonly denied: boolean;
  /** The game and the search are still being read. */
  readonly loading: boolean;
  /** The game the space's host holds; `null` without one. */
  readonly game: MultiplayerStandingGame | null;
  /** A search is waiting for an opponent. */
  readonly searching: boolean;
  /** The person plays the game, or hosts the space a search starts from. */
  readonly mayFind: boolean;
};

/**
 * The stage, from the data alone. An unfinished game comes before a search
 * and a search before a finished game, so a person who seeks a new opponent
 * after a game waits on the search's own screen.
 */
export function multiplayerStageOf(
  standing: MultiplayerStanding
): MultiplayerStage {
  if (standing.denied) return 'denied';
  if (standing.game?.ongoing === true)
    return standing.game.awaitingSetups ? 'setup' : 'playing';
  if (standing.searching) return 'searching';
  if (standing.game !== null) return 'finished';
  if (standing.loading) return 'loading';
  return standing.mayFind ? 'idle' : 'unavailable';
}

function parentOf(place: MultiplayerPlace): MultiplayerPlace | null {
  if (
    place.screen === 'time-control' ||
    place.screen === 'ratings' ||
    place.screen === 'guide'
  )
    return { screen: 'find' };
  if (place.screen === 'commands' || place.screen === 'moves')
    return { screen: 'play' };
  return null;
}

/**
 * The places of finding an opponent. Back from the ratings or the moves of
 * a finished game leads to its result, the stage's home, because the stage
 * shows neither `find` nor `play`.
 */
export const MULTIPLAYER_PLACES = defineScreenPlaces<
  MultiplayerStage,
  MultiplayerPlace
>({
  home: {
    loading: { screen: 'status' },
    unavailable: { screen: 'status' },
    denied: { screen: 'status' },
    idle: { screen: 'find' },
    searching: { screen: 'searching' },
    setup: { screen: 'private-setup' },
    playing: { screen: 'play' },
    finished: { screen: 'result' },
  },
  screens: {
    loading: ['status'],
    unavailable: ['status'],
    denied: ['status'],
    idle: ['find', 'time-control', 'ratings', 'guide'],
    searching: ['searching'],
    setup: ['private-setup', 'commands'],
    playing: ['play', 'commands', 'moves'],
    finished: ['result', 'moves', 'ratings'],
  },
  parent: parentOf,
});

/**
 * The one place that outlives its stage: a person stepping through the
 * moves when the game ends goes on stepping through them, on the position
 * they chose. Every other stage change lands on the new stage's home
 * (`null`).
 */
export function multiplayerPlaceKept(
  from: { readonly stage: MultiplayerStage; readonly place: MultiplayerPlace },
  to: MultiplayerStage
): MultiplayerPlace | null {
  return from.stage === 'playing' &&
    to === 'finished' &&
    from.place.screen === 'moves'
    ? from.place
    : null;
}
