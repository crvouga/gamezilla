import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import { wordTilesAutomation } from './word-tiles-automation';
import {
  WORD_TILES_RULES,
  wordTilesBots,
  wordTilesRecord,
} from './word-tiles-rules';

/**
 * Word Tiles, at a table of two, three or four: each size its own
 * registered mode sharing one implementation (family `word-tiles`).
 */
function definition(rules: (typeof WORD_TILES_RULES)[2]) {
  return defineTurnGame({
    rules,
    capabilities: {
      'custom-games': { bots: wordTilesBots },
      history: { record: wordTilesRecord },
    },
    automation: wordTilesAutomation,
  });
}

export const wordTilesGameShared = definition(WORD_TILES_RULES[2]);
export const wordTiles3GameShared = definition(WORD_TILES_RULES[3]);
export const wordTiles4GameShared = definition(WORD_TILES_RULES[4]);
