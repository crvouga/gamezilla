import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { FramePhase } from './game-frame-view-types';

/**
 * The custom game's small screens. Its stage is the game's own phase
 * (`FramePhase`: nobody navigates it); a place is the one screen this
 * device shows within that phase.
 */
export type CustomGamePlace =
  | {
      readonly screen:
        | 'start'
        | 'lobby'
        | 'options'
        | 'clock'
        | 'private-setup'
        | 'play'
        | 'commands'
        | 'moves'
        | 'result';
    }
  /** Who sits in one seat, while the game is set up; inviting a member to it. */
  | { readonly screen: 'seat' | 'invite'; readonly side: GameSide };

export type CustomGameScreenName = CustomGamePlace['screen'];

/**
 * What each phase shows. Before a game: starting one. While it is set up:
 * the lobby, and from it one seat (and inviting someone to it), the
 * options, the clock and the person's private setup. While it is played: the live board, the game's commands
 * and the moves. Once it is over: the result, and the moves.
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
    configuring: [
      'lobby',
      'seat',
      'invite',
      'options',
      'clock',
      'private-setup',
    ],
    active: ['play', 'commands', 'moves'],
    completed: ['result', 'moves'],
    cancelled: ['result', 'moves'],
  },
  // Inviting is behind its seat; every other place is one step from home.
  parent: (place) =>
    place.screen === 'invite' ? { screen: 'seat', side: place.side } : null,
});
