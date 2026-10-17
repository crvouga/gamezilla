import { connectFourGameClient } from '@libs/connect-four-client/connect-four-game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { CONNECT_FOUR_ACTIONS } from './connect-four-actions';
import { establishConnectFourBotPosition } from './connect-four-bots';
import { CONNECT_FOUR_PLAYABLE } from './connect-four-playable';

/** Connect Four as every shared game suite exercises it. */
export const CONNECT_FOUR_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...CONNECT_FOUR_PLAYABLE,
  client: connectFourGameClient,
  actions: [...CONNECT_FOUR_ACTIONS, establishConnectFourBotPosition],
});
