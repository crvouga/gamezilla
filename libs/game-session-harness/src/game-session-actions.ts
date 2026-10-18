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
import { PUZZLE_MOVE_ACTIONS } from './puzzle-moves';
import { PUZZLE_RECORD_ACTIONS } from './puzzle-records';
import { PUZZLE_ROOM_PROBE_ACTIONS } from './puzzle-room-probe';
import { PUZZLE_SCREEN_ACTIONS } from './puzzle-screen';
import { SPACE_GAME_CHOICE_ACTIONS } from './space-game-choice';

/** The testing tool's shared game actions, the same for every game. */
export const GAME_SESSION_HARNESS_ACTIONS = [
  ...GAME_NAVIGATION_ACTIONS,
  ...SPACE_GAME_CHOICE_ACTIONS,
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
  ...PUZZLE_SCREEN_ACTIONS,
  ...PUZZLE_RECORD_ACTIONS,
  ...PUZZLE_MOVE_ACTIONS,
  ...PUZZLE_ROOM_PROBE_ACTIONS,
];
