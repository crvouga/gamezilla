import {
  chooseCustomGameBotMove,
  playCustomGameBots,
} from './custom-game-bots';
import { establishCustomGame } from './custom-game-lineup';
import { makeCustomGameMove } from './custom-game-moves';
import {
  attemptCustomGame,
  attemptCustomGameChoice,
  configureCustomGameChoice,
} from './custom-game-ui';
import { openGameHistory, reviewCustomGameMove } from './game-history-actions';
import { GAME_NAVIGATION_ACTIONS } from './game-navigation';

/** The testing tool's shared game actions, the same for every game. */
export const GAME_SESSION_HARNESS_ACTIONS = [
  ...GAME_NAVIGATION_ACTIONS,
  establishCustomGame,
  attemptCustomGame,
  attemptCustomGameChoice,
  configureCustomGameChoice,
  makeCustomGameMove,
  reviewCustomGameMove,
  openGameHistory,
  chooseCustomGameBotMove,
  playCustomGameBots,
];
