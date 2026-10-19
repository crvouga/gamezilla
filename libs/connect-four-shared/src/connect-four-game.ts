import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import { connectFourAutomation } from './connect-four-automation';
import { connectFourNoticeText } from './connect-four-notice-text';
import {
  connectFourBots,
  connectFourRecord,
  connectFourRules,
} from './connect-four-rules';

/** Connect Four offers every shared capability; its rules are its own. */
export const connectFourGameShared = defineTurnGame({
  rules: connectFourRules,
  capabilities: {
    'custom-games': { bots: connectFourBots },
    matchmaking: {
      clockNamespace: 'connect-four/',
      notice: connectFourNoticeText,
    },
    history: { record: connectFourRecord },
  },
  automation: connectFourAutomation,
});
