import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import type { GameDefinition } from '@libs/spaces-shared/game';
import type { RegisteredTurnGame } from '@pkgs/turn-game-shared/game-rules';
import { GAME_CAPABILITIES } from '@pkgs/turn-game-shared/game-rules';
import { connectFourAutomation } from './connect-four-automation';
import { connectFourNoticeText } from './connect-four-notice-text';
import { connectFourRules } from './connect-four-rules';

export const connectFourTurnGame: RegisteredTurnGame = {
  rules: connectFourRules,
  controlPrefix: 'connect-four/',
  notice: connectFourNoticeText,
  capabilities: GAME_CAPABILITIES,
};

/** The space's shared custom-game and competitive lifecycles own sessions. */
export const connectFourGameShared = {
  id: 'connect-four',
  automation: connectFourAutomation,
  roomCapabilities: [GAME_ROOM_CAPABILITY],
  turnGame: connectFourTurnGame,
  commandRouters: [],
  eventRouters: [],
  recoverEffects: () => [],
} satisfies GameDefinition;
