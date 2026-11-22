import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';
import type { FramePhase } from './game-frame-view-types';

/**
 * The custom game's small screens. Its stage is the game's own phase
 * (`FramePhase`: nobody navigates it); a place is the one screen this
 * device shows within that phase.
 */
export type CustomGamePlace = {
  readonly screen: 'start' | 'lobby' | 'play' | 'commands' | 'moves' | 'result';
};

export type CustomGameScreenName = CustomGamePlace['screen'];

/**
 * What each phase shows. Before a game: starting one. While it is set up:
 * the lobby, which holds the seats, the options, the clock and the
 * person's private setup on one screen. While it is played: the live
 * board, the game's commands and the moves. Once it is over: the result,
 * and the moves.
 */
export const CUSTOM_GAME_PLACES = defineScreenPlaces<
  FramePhase,
  CustomGamePlace
>({
  home: {
    none: { screen: 'start' },
    configuring: { screen: 'lobby' },
    active: { screen: 'play' },
    completed: { screen: 'result' },
    cancelled: { screen: 'result' },
  },
  screens: {
    none: ['start'],
    configuring: ['lobby'],
    active: ['play', 'commands', 'moves'],
    completed: ['result', 'moves'],
    cancelled: ['result', 'moves'],
  },
  // Every place is one step from its phase's home.
  parent: () => null,
});
