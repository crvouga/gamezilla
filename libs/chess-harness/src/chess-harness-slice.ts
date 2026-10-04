import { createMultiplayerChessClient } from '@libs/app-client/multiplayer-chess-client';
import type { HarnessSlice } from '@libs/harness/slices';
import { CHESS_FEATURE } from '@libs/chess-feature-shared/feature';
import { CHESS_SERVER } from '@libs/chess-server/feature-server';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { CUSTOM_GAME_HARNESS_ACTIONS } from '@libs/chess-custom-game-harness/custom-game-actions';
import { MULTIPLAYER_HARNESS_ACTIONS } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { sendMultiplayerCommand } from './multiplayer-commands';
import {
  controlledMultiplayerCommand,
  receiveMultiplayerMatch,
} from './multiplayer-events';
import {
  givenMultiplayerPosition,
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'chess',
  feature: CHESS_FEATURE,
  client: createMultiplayerChessClient(
    () => import('@libs/chess-matchmaking-client/multiplayer-screen')
  ),
  server: () => CHESS_SERVER,
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CHESS_HARNESS_ACTIONS,
    ...CUSTOM_GAME_HARNESS_ACTIONS,
    ...MULTIPLAYER_HARNESS_ACTIONS,
    givenOpponentSearch,
    pairChessOpponents,
    sendMultiplayerCommand,
    givenMultiplayerPosition,
    controlledMultiplayerCommand,
    receiveMultiplayerMatch,
  ],
  properties: [nextPuzzleDifferent],
};
