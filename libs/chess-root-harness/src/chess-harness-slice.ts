import { createMultiplayerChessClient } from '@libs/app-root-client/multiplayer-chess-client';
import { CUSTOM_GAME_HARNESS_ACTIONS } from '@libs/chess-custom-game-harness/custom-game-actions';
import { CHESS_FEATURE } from '@libs/chess-feature-shared/feature';
import MultiplayerScreen from '@libs/chess-matchmaking-client/multiplayer-screen';
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
import { passMultiplayerTime } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { CHESS_SERVER } from '@libs/chess-root-server/feature-server';
import type { HarnessSlice } from '@libs/harness/slices';
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
  client: createMultiplayerChessClient(MultiplayerScreen),
  server: () => CHESS_SERVER,
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CHESS_HARNESS_ACTIONS,
    ...CUSTOM_GAME_HARNESS_ACTIONS,
    ...MULTIPLAYER_HARNESS_ACTIONS,
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
  ],
  properties: [nextPuzzleDifferent],
};
