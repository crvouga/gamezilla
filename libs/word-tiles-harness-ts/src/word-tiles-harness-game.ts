import {
  assertHarnessGame,
  type HarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import {
  wordTiles3GameClient,
  wordTiles4GameClient,
  wordTilesGameClient,
} from '@libs/word-tiles-client-ts/word-tiles-game-client';
import {
  WORD_TILES_3_PLAYABLE,
  WORD_TILES_4_PLAYABLE,
  WORD_TILES_PLAYABLE,
} from './word-tiles-playable';
import { readWordTilesRecord } from './word-tiles-record-reading';

export const WORD_TILES_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...WORD_TILES_PLAYABLE,
  client: wordTilesGameClient,
  readRecord: readWordTilesRecord,
});

export const WORD_TILES_3_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...WORD_TILES_3_PLAYABLE,
  client: wordTiles3GameClient,
});

export const WORD_TILES_4_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...WORD_TILES_4_PLAYABLE,
  client: wordTiles4GameClient,
});
