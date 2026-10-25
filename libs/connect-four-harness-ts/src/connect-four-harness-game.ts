import { connectFourGameClient } from '@libs/connect-four-client-ts/connect-four-game-client';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { CONNECT_FOUR_ACTIONS } from './connect-four-actions';
import { establishConnectFourBotPosition } from './connect-four-bots';
import { CONNECT_FOUR_PLAYABLE } from './connect-four-playable';
import { readConnectFourRecord } from './connect-four-record-reading';

/** Connect Four as every shared game suite exercises it. */
export const CONNECT_FOUR_HARNESS_GAME: TurnHarnessGame = assertHarnessGame({
  ...CONNECT_FOUR_PLAYABLE,
  client: connectFourGameClient,
  actions: [...CONNECT_FOUR_ACTIONS, establishConnectFourBotPosition],
  readRecord: readConnectFourRecord,
});
