import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import { battleshipAutomation } from './battleship-automation';
import { battleshipBots } from './battleship-bot';
import { battleshipNoticeText } from './battleship-notice-text';
import { battleshipRecord } from './battleship-record';
import { battleshipRules } from './battleship-rules';

/** Battleship offers custom games, matchmaking and history; no puzzles. */
export const battleshipGameShared = defineTurnGame({
  rules: battleshipRules,
  capabilities: {
    'custom-games': { bots: battleshipBots },
    matchmaking: {
      clockNamespace: 'battleship/',
      notice: battleshipNoticeText,
    },
    history: { record: battleshipRecord },
  },
  automation: battleshipAutomation,
});
