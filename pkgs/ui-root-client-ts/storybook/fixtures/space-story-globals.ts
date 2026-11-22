import type { SpaceRole } from '../../src/space-types';
import type {
  SpaceExampleGameKey,
  SpaceExamplePlayKey,
} from './space-example-games';

/**
 * The Space screen stories show one screen each; the game and the viewer's
 * role come from the `spaceGame` and `spaceRole` toolbar globals next to the
 * theme, not from one story per game and role.
 */
export const SPACE_STORY_GAMES = [
  'light-cycles',
  'chess',
  'hearts',
  'battleship',
  'word-tiles',
] as const;

export type SpaceStoryGame = (typeof SPACE_STORY_GAMES)[number];

/**
 * The games whose board `@pkgs/ui` draws in play. Chess draws its own, so
 * Chess in play is its package's story (`Space/InGameChess`).
 */
export const SPACE_STORY_PLAY_GAMES = [
  'light-cycles',
  'hearts',
  'battleship',
  'word-tiles',
] as const satisfies readonly SpaceStoryGame[];

export type SpaceStoryPlayGame = (typeof SPACE_STORY_PLAY_GAMES)[number];

export const SPACE_STORY_ROLES: readonly SpaceRole[] = ['host', 'guest'];

/**
 * The game and role combinations a Space screen story renders, as
 * `parameters.spaceMatrix`. Visual checks visit each one through the URL
 * globals (`&globals=spaceGame:hearts;spaceRole:host`).
 */
export type SpaceMatrix = {
  readonly games: readonly SpaceStoryGame[];
  readonly roles: readonly SpaceRole[];
};

/** The game the toolbar selects; Light Cycles when unset or unknown. */
export function spaceStoryGame(
  globals: Readonly<Record<string, unknown>>
): SpaceStoryGame {
  const value = globals['spaceGame'];
  return SPACE_STORY_GAMES.find((game) => game === value) ?? 'light-cycles';
}

/**
 * The toolbar's game where `@pkgs/ui` draws the board in play; Light Cycles
 * when unset, unknown or Chess.
 */
export function spaceStoryPlayGame(
  globals: Readonly<Record<string, unknown>>
): SpaceStoryPlayGame {
  const value = globals['spaceGame'];
  return (
    SPACE_STORY_PLAY_GAMES.find((game) => game === value) ?? 'light-cycles'
  );
}

/** The role the toolbar selects; a guest when unset or unknown. */
export function spaceStoryRole(
  globals: Readonly<Record<string, unknown>>
): SpaceRole {
  return globals['spaceRole'] === 'host' ? 'host' : 'guest';
}

/** The `@pkgs/ui` reference fixture for each game. */
export const SPACE_STORY_FIXTURE: Readonly<
  Record<SpaceStoryGame, SpaceExampleGameKey>
> = {
  'light-cycles': 'lightCycles',
  chess: 'chess',
  hearts: 'hearts',
  battleship: 'battleship',
  'word-tiles': 'wordTiles',
};

/** The `@pkgs/ui` fixture of each game whose board `@pkgs/ui` draws. */
export const SPACE_STORY_PLAY_FIXTURE: Readonly<
  Record<SpaceStoryPlayGame, SpaceExamplePlayKey>
> = {
  'light-cycles': 'lightCycles',
  hearts: 'hearts',
  battleship: 'battleship',
  'word-tiles': 'wordTiles',
};
