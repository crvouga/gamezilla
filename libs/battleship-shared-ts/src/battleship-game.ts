import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { battleshipAutomation } from './battleship-automation';
import { battleshipBots } from './battleship-bot';
import { battleshipNoticeText } from './battleship-notice-text';
import { battleshipRecord } from './battleship-record';
import { battleshipRules } from './battleship-rules';

/** Battleship offers custom games, matchmaking and history; no puzzles. */
export const battleshipGameShared = defineGame({
  rules: battleshipRules,
  capabilities: {
    'custom-games': { bots: battleshipBots },
    matchmaking: {
      clockChoices: true as const,
      namespace: 'battleship/',
      notice: battleshipNoticeText,
    },
    history: { record: battleshipRecord },
  },
  turnAutomation: battleshipAutomation,
});
