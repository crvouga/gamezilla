import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import {
  wordTiles3GameShared,
  wordTiles4GameShared,
  wordTilesGameShared,
} from '@libs/word-tiles-shared-ts/word-tiles-game';
import {
  DEFAULT_LEXICON_KEY,
  loadLexicon,
} from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import {
  WORD_TILES_2_FIXTURES,
  WORD_TILES_3_FIXTURES,
  WORD_TILES_4_FIXTURES,
} from './word-tiles-fixtures';

// Every driver of the game decides with the pinned word list loaded, as
// the authority does once its rule data is prepared.
await loadLexicon(DEFAULT_LEXICON_KEY);

export const WORD_TILES_PLAYABLE: PlayableGame = {
  label: 'Word Tiles',
  shared: wordTilesGameShared,
  fixtures: WORD_TILES_2_FIXTURES,
};

export const WORD_TILES_3_PLAYABLE: PlayableGame = {
  label: 'Word Tiles for three',
  shared: wordTiles3GameShared,
  fixtures: WORD_TILES_3_FIXTURES,
};

export const WORD_TILES_4_PLAYABLE: PlayableGame = {
  label: 'Word Tiles for four',
  shared: wordTiles4GameShared,
  fixtures: WORD_TILES_4_FIXTURES,
};
