import { describe, expect, test } from 'bun:test';
import {
  WORD_TILES_3_HARNESS_GAME,
  WORD_TILES_4_HARNESS_GAME,
  WORD_TILES_HARNESS_GAME,
} from '@libs/word-tiles-harness-ts/word-tiles-harness-game';
import { decodePosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { wordTilesHands } from '@libs/word-tiles-shared-ts/word-tiles-rules';

/**
 * The known victories end with the scores worked out by hand in the
 * fixtures' comments: the deal, the words, the bonus squares and the racks
 * left all agree with what the game's own rules decide.
 */
const FINAL_SCORES = new Map([
  [WORD_TILES_HARNESS_GAME, [27, -6]],
  [WORD_TILES_3_HARNESS_GAME, [26, -6, -11]],
  [WORD_TILES_4_HARNESS_GAME, [26, 9, 18, -13]],
]);

for (const [game, scores] of FINAL_SCORES)
  describe(game.label, () => {
    test('the known victory ends with the hand-worked scores', () => {
      const rules = game.shared.turnGame.rules;
      let position = rules.initial();
      let hidden = game.fixtures.knownDeal!.hidden;
      let history = '';
      for (const proposal of game.fixtures.firstSideVictory) {
        const resolution = wordTilesHands.resolve(position, proposal, hidden);
        if ('refusal' in resolution) throw new Error(resolution.refusal);
        const played = rules.play(position, resolution.action, history, []);
        if (played === null) throw new Error(`${resolution.action} refused`);
        ({ position, history } = played);
        hidden = resolution.hidden;
      }
      expect(decodePosition(position)?.scores).toEqual(scores);
      expect(decodePosition(position)?.ended).toBe('scoreless');
    });
  });
