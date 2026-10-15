import { CUSTOM_GAME_HARNESS_ACTIONS } from '@libs/chess-custom-game-harness/custom-game-actions';
import { MULTIPLAYER_HARNESS_ACTIONS } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  closeMultiplayerApp,
  reopenMultiplayerApp,
} from '@libs/chess-matchmaking-harness/multiplayer-app';
import { sendMultiplayerCommand } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  awaitChessMatch,
  givenMultiplayerClock,
  givenMultiplayerPosition,
  givenMultiplayerRating,
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  givenOpenedTurnNotice,
  openMultiplayerNotice,
} from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import {
  passMultiplayerDays,
  passMultiplayerTime,
} from '@libs/chess-matchmaking-harness/multiplayer-time';
import { joinMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { PERSONAL_CHESS_STATS_CLIENT } from '@libs/chess-puzzle-client/personal-chess-stats-client';
import { PUZZLE_LINK_CLIENT } from '@libs/chess-puzzle-client/puzzle-link-client';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { createChessServer } from '@libs/chess-root-server/sub-server';
import { CHESS_SUB } from '@libs/chess-sub-shared/sub';
import { CONNECT_FOUR_ACTIONS } from '@libs/connect-four-harness/connect-four-actions';
import {
  establishConnectFourBotPosition,
  playConnectFourBots,
} from '@libs/connect-four-harness/connect-four-bots';
import { CONNECT_FOUR_MATCHMAKING_ACTIONS } from '@libs/connect-four-harness/connect-four-matchmaking';
import {
  openConnectFourHistory,
  preferConnectFourReducedMotion,
  reviewConnectFour,
} from '@libs/connect-four-harness/connect-four-review';
import { TURN_GAMES } from '@libs/game-catalog-shared/turn-games';
import { createMultiplayerLinkClient } from '@libs/game-matchmaking-client/multiplayer-link-client';
import type { HarnessSlice } from '@libs/harness/slices';
import { focusChessScreen } from './chess-screen-reads';
import { setCustomGameParticipation } from './custom-game-participation';
import {
  controlledMultiplayerCommand,
  receiveMultiplayerMatch,
} from './multiplayer-events';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'chess',
  sub: CHESS_SUB,
  client: {
    name: 'chess',
    routes: [
      ...PUZZLE_LINK_CLIENT.routes,
      ...createMultiplayerLinkClient(TURN_GAMES).routes,
      ...PERSONAL_CHESS_STATS_CLIENT.routes,
    ],
    ...(PERSONAL_CHESS_STATS_CLIENT.settings === undefined
      ? {}
      : { settings: PERSONAL_CHESS_STATS_CLIENT.settings }),
  },
  server: () => createChessServer(),
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CONNECT_FOUR_ACTIONS,
    ...CONNECT_FOUR_MATCHMAKING_ACTIONS,
    reviewConnectFour,
    openConnectFourHistory,
    preferConnectFourReducedMotion,
    establishConnectFourBotPosition,
    playConnectFourBots,
    ...CHESS_HARNESS_ACTIONS,
    ...CUSTOM_GAME_HARNESS_ACTIONS,
    ...MULTIPLAYER_HARNESS_ACTIONS,
    joinMultiplayerSpace,
    givenMultiplayerSpace,
    givenOpponentSearch,
    pairChessOpponents,
    awaitChessMatch,
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
    focusChessScreen,
    setCustomGameParticipation,
  ],
  properties: [nextPuzzleDifferent],
};
