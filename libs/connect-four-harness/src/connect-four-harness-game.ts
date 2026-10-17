import { connectFourGameClient } from '@libs/connect-four-client/connect-four-game-client';
import { connectFourGameShared } from '@libs/connect-four-shared/connect-four-game';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { CONNECT_FOUR_ACTIONS } from './connect-four-actions';
import { establishConnectFourBotPosition } from './connect-four-bots';

/** Connect Four as every shared game suite exercises it. */
export const CONNECT_FOUR_HARNESS_GAME: HarnessGame = assertHarnessGame({
  label: 'Connect Four',
  shared: connectFourGameShared,
  client: connectFourGameClient,
  actions: [...CONNECT_FOUR_ACTIONS, establishConnectFourBotPosition],
  // Red stacks four in the first column while Yellow plays the second.
  firstSideVictory: ['0', '1', '0', '1', '0', '1', '0'],
});
