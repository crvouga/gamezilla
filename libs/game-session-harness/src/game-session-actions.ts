import {
  assignCustomGameBotWithKeyboard,
  listenToCustomGame,
  startCustomGameWithKeyboard,
} from './custom-game-accessibility';
import { repeatCustomGameAcknowledgement } from './custom-game-acknowledgement';
import { redeliverCustomGameBotWake } from './custom-game-bot-wakes';
import {
  chooseCustomGameBotMove,
  playCustomGameBots,
} from './custom-game-bots';
import { attemptCustomGameBoundary } from './custom-game-boundary';
import { createCustomGameIn, operateCustomGame } from './custom-game-controls';
import { playCustomGameHistory } from './custom-game-history';
import {
  establishCustomGame,
  joinCustomGames,
  joinCustomGamesAsGuest,
  returnToCustomGames,
} from './custom-game-lineup';
import { makeCustomGameMove } from './custom-game-moves';
import { raceCustomGameChoices } from './custom-game-race';
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
  joinCustomGames,
  joinCustomGamesAsGuest,
  returnToCustomGames,
  operateCustomGame,
  createCustomGameIn,
  raceCustomGameChoices,
  attemptCustomGame,
  attemptCustomGameChoice,
  configureCustomGameChoice,
  makeCustomGameMove,
  reviewCustomGameMove,
  openGameHistory,
  chooseCustomGameBotMove,
  playCustomGameBots,
  playCustomGameHistory,
  attemptCustomGameBoundary,
  repeatCustomGameAcknowledgement,
  redeliverCustomGameBotWake,
  assignCustomGameBotWithKeyboard,
  startCustomGameWithKeyboard,
  listenToCustomGame,
];
