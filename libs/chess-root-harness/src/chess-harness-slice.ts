import { CUSTOM_GAME_HARNESS_ACTIONS } from '@libs/chess-custom-game-harness/custom-game-actions';
import { CHESS_FEATURE } from '@libs/chess-feature-shared/feature';
import { MULTIPLAYER_HARNESS_ACTIONS } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { sendMultiplayerCommand } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  awaitChessMatch,
  givenMultiplayerClock,
  givenMultiplayerPosition,
  givenMultiplayerRating,
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { passMultiplayerTime } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { joinMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { createChessServer } from '@libs/chess-root-server/feature-server';
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
  feature: CHESS_FEATURE,
  server: (deps) => createChessServer(deps.rooms),
  seedServer: seedChessPuzzlesForHarness,
  actions: [
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
    controlledMultiplayerCommand,
    receiveMultiplayerMatch,
    focusChessScreen,
    setCustomGameParticipation,
  ],
  properties: [nextPuzzleDifferent],
};
