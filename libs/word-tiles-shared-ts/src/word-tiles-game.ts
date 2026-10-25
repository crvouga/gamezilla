import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import type { GameNoticeText } from '@pkgs/turn-game-shared-ts/game-rules';
import { wordTilesAutomation } from './word-tiles-automation';
import {
  WORD_TILES_REASONS,
  WORD_TILES_RULES,
  wordTilesBots,
  wordTilesRecord,
  wordTilesSideLabel,
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

/** What the server says of a matched game without the client's translations. */
const NOTICE: GameNoticeText = {
  side: wordTilesSideLabel,
  timeoutDraw: (side) =>
    `${wordTilesSideLabel(side)} ran out of time. The game is a draw.`,
  ending: (reason) =>
    reason === WORD_TILES_REASONS.out
      ? 'A player used their last tile with the bag empty.'
      : reason === WORD_TILES_REASONS.scoreless
        ? 'Six turns in a row scored nothing.'
        : undefined,
};

/** Two players also find an opponent: matched games, ratings and records. */
export const wordTilesGameShared = defineTurnGame({
  rules: WORD_TILES_RULES[2],
  capabilities: {
    'custom-games': { bots: wordTilesBots },
    matchmaking: { clockNamespace: 'word-tiles/', notice: NOTICE },
    history: { record: wordTilesRecord },
  },
  automation: wordTilesAutomation,
});
export const wordTiles3GameShared = definition(WORD_TILES_RULES[3]);
export const wordTiles4GameShared = definition(WORD_TILES_RULES[4]);
