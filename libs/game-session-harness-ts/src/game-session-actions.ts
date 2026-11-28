import { openGameHistory, reviewGameSessionMove } from './game-history-actions';
import { GAME_NAVIGATION_ACTIONS } from './game-navigation';
import {
  assignGameSessionBotWithKeyboard,
  listenToGameSession,
  startGameSessionWithKeyboard,
} from './game-session-accessibility';
import { repeatGameSessionAcknowledgement } from './game-session-acknowledgement';
import { redeliverGameSessionBotWake } from './game-session-bot-wakes';
import {
  chooseGameSessionBotMove,
  finishGameSessionAgainstBots,
  playGameSessionBots,
} from './game-session-bots';
import { attemptGameSessionBoundary } from './game-session-boundary';
import {
  createGameSessionIn,
  operateGameSession,
} from './game-session-controls';
import { leaveGameSessionSpace } from './game-session-departure';
import { playGameSessionHistory } from './game-session-history';
import {
  establishGameSession,
  joinGameSessions,
  joinGameSessionsAsGuest,
  returnToGameSessions,
} from './game-session-lineup';
import { makeGameSessionMove } from './game-session-moves';
import { raceGameSessionChoices } from './game-session-race';
import {
  attemptGameSession,
  attemptGameSessionChoice,
  configureGameSessionChoice,
} from './game-session-ui';
import { PUZZLE_ALLOWANCE_ACTIONS } from './puzzle-allowance';
import { PUZZLE_FEED_ACTIONS } from './puzzle-feed';
import { PUZZLE_FEED_CHOICE_ACTIONS } from './puzzle-feed-choices';
import { PUZZLE_FINISH_ACTIONS } from './puzzle-finishes';
import { PUZZLE_LINK_ACTIONS } from './puzzle-link';
import { PUZZLE_LISTENING_ACTIONS } from './puzzle-listening';
import { PUZZLE_MOVE_ACTIONS } from './puzzle-moves';
import { PUZZLE_POOL_ACTIONS } from './puzzle-pool';
import { PUZZLE_RECORD_ACTIONS } from './puzzle-records';
import { PUZZLE_RESULT_RECOVERY_ACTIONS } from './puzzle-result-recovery';
import { PUZZLE_ROOM_PROBE_ACTIONS } from './puzzle-room-probe';
import { PUZZLE_SCREEN_ACTIONS } from './puzzle-screen';
import { SPACE_GAME_CHOICE_ACTIONS } from './space-game-choice';

/** The testing tool's shared game actions, the same for every game. */
export const GAME_SESSION_HARNESS_ACTIONS = [
  ...GAME_NAVIGATION_ACTIONS,
  ...SPACE_GAME_CHOICE_ACTIONS,
  establishGameSession,
  joinGameSessions,
  joinGameSessionsAsGuest,
  returnToGameSessions,
  operateGameSession,
  leaveGameSessionSpace,
  createGameSessionIn,
  raceGameSessionChoices,
  attemptGameSession,
  attemptGameSessionChoice,
  configureGameSessionChoice,
  makeGameSessionMove,
  reviewGameSessionMove,
  openGameHistory,
  chooseGameSessionBotMove,
  finishGameSessionAgainstBots,
  playGameSessionBots,
  playGameSessionHistory,
  attemptGameSessionBoundary,
  repeatGameSessionAcknowledgement,
  redeliverGameSessionBotWake,
  assignGameSessionBotWithKeyboard,
  startGameSessionWithKeyboard,
  listenToGameSession,
  ...PUZZLE_SCREEN_ACTIONS,
  ...PUZZLE_RECORD_ACTIONS,
  ...PUZZLE_MOVE_ACTIONS,
  ...PUZZLE_ROOM_PROBE_ACTIONS,
  ...PUZZLE_FEED_ACTIONS,
  ...PUZZLE_FEED_CHOICE_ACTIONS,
  ...PUZZLE_POOL_ACTIONS,
  ...PUZZLE_ALLOWANCE_ACTIONS,
  ...PUZZLE_LINK_ACTIONS,
  ...PUZZLE_FINISH_ACTIONS,
  ...PUZZLE_RESULT_RECOVERY_ACTIONS,
  ...PUZZLE_LISTENING_ACTIONS,
];
