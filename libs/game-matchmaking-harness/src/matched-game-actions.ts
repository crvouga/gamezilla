import { closeMultiplayerApp, reopenMultiplayerApp } from './multiplayer-app';
import { joinMultiplayerSpace } from './multiplayer-board';
import { sendMultiplayerCommand } from './multiplayer-commands';
import {
  refreshMultiplayerConnection,
  setMultiplayerConnection,
} from './multiplayer-connection';
import {
  controlledMultiplayerCommand,
  receiveMultiplayerMatch,
} from './multiplayer-events';
import {
  awaitGameMatch,
  givenMultiplayerClock,
  givenMultiplayerPosition,
  givenMultiplayerRating,
  givenOpponentSearch,
  pairGameOpponents,
} from './multiplayer-fixtures';
import {
  givenOpenedTurnNotice,
  openMultiplayerNotice,
} from './multiplayer-notices';
import { passMultiplayerDays, passMultiplayerTime } from './multiplayer-time';

/**
 * The testing tool's matched-game actions, the same for every game offering
 * finding an opponent: the people's devices and connections, the fixtures
 * that set a search, a game, a clock or a rating, and time passing.
 */
export const MATCHED_GAME_HARNESS_ACTIONS = [
  refreshMultiplayerConnection,
  setMultiplayerConnection,
  joinMultiplayerSpace,
  givenOpponentSearch,
  pairGameOpponents,
  awaitGameMatch,
  sendMultiplayerCommand,
  givenMultiplayerPosition,
  givenMultiplayerClock,
  givenMultiplayerRating,
  passMultiplayerTime,
  passMultiplayerDays,
  closeMultiplayerApp,
  reopenMultiplayerApp,
  openMultiplayerNotice,
  givenOpenedTurnNotice,
  controlledMultiplayerCommand,
  receiveMultiplayerMatch,
];
