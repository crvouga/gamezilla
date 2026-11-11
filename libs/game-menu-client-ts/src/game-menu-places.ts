import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';

/**
 * A game's menu on one device: the hub of its choices and, behind it, how
 * the game is played. Which template screen the whole space is in is the
 * space-wide game screen (`useGameScreen`), never a place.
 */

/** The menu stands in one stage: it is always open. */
export type GameMenuStage = 'open';

/** The small screen shown: the choices, or how to play. */
export type GameMenuPlace =
  | { readonly screen: 'menu' }
  | { readonly screen: 'how-to-play' };

const MENU: GameMenuPlace = { screen: 'menu' };

export const GAME_MENU_PLACES = defineScreenPlaces<
  GameMenuStage,
  GameMenuPlace
>({
  home: { open: MENU },
  screens: { open: ['menu', 'how-to-play'] },
  parent: (place) => (place.screen === 'how-to-play' ? MENU : null),
});
