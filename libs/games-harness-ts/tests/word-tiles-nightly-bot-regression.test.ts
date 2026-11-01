import { test } from 'bun:test';
import { gameBotLaws } from '@libs/game-session-harness-ts/game-rules-laws';
import { WORD_TILES_HARNESS_GAME } from '@libs/word-tiles-harness-ts/word-tiles-harness-game';

// regression: word-tiles-nightly-bot-corpus
test('the pinned nightly Word Tiles bot corpus keeps every move legal', async () => {
  await WORD_TILES_HARNESS_GAME.shared.turnGame.rules.prepare?.();
  for (const law of gameBotLaws(WORD_TILES_HARNESS_GAME, {
    seed: 424_242,
    numRuns: 200,
  }))
    law.check();
  // Keep the same deadline as the shared bot-law runner.
}, 60_000);
