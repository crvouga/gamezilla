import { createMultiplayerChessClient } from '@libs/client-app/chrome/multiplayer-chess-client';
import type { HarnessSlice } from '@libs/harness/slices';
import { CHESS_FEATURE } from '../root/feature';
import { CHESS_SERVER } from '../root/server/feature-server';
import { CHESS_HARNESS_ACTIONS } from './chess-actions';
import { seedChessPuzzlesForHarness } from './chess-harness-seed';
import { nextPuzzleDifferent } from './chess-properties';
import { MULTIPLAYER_HARNESS_ACTIONS } from './multiplayer-actions';
import { sendMultiplayerCommand } from './multiplayer-commands';
import {
  controlledMultiplayerCommand,
  receiveMultiplayerMatch,
} from './multiplayer-events';
import {
  givenMultiplayerPosition,
  givenOpponentSearch,
  pairChessOpponents,
} from './multiplayer-fixtures';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'chess',
  feature: CHESS_FEATURE,
  client: createMultiplayerChessClient(
    () => import('../root/client/multiplayer-screen')
  ),
  server: () => CHESS_SERVER,
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CHESS_HARNESS_ACTIONS,
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
