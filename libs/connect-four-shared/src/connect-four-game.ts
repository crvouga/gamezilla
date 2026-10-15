import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import { connectFourRules } from './connect-four-rules';
/** The space's shared custom-game and competitive lifecycles own sessions. */
export const connectFourGameShared = {
  id: 'connect-four',
  roomCapabilities: [GAME_ROOM_CAPABILITY],
  turnGame: { rules: connectFourRules, controlPrefix: 'connect-four/' },
  commandRouters: [],
  eventRouters: [],
  recoverEffects: () => [],
} as const;
