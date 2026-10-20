/**
 * The shared history of every game offering it records what happened to a
 * custom game, and nothing that did not.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { attemptCustomGame } from '@libs/game-session-harness/custom-game-ui';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness/game-history-actions';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    // regression: cancelled-history-invents-bot
    test('a cancelled game with an unfilled place records no invented bot or result', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-cancelled-history`
      );
      await s.apply(establishCustomGame, game.shared.id, {
        second: 'open',
        active: false,
      });
      await s.apply(attemptCustomGame, 'alice', { operation: 'cancel' });
      await s.apply(openGameHistory, 'alice');
      const history = await s.read(gameHistoryStatistics, 'alice');
      expect(history.record).toContain('No participant');
      expect(history.record).toContain('Game cancelled');
      expect(history.record).not.toContain('Bot');
      expect([history.wins, history.losses, history.draws]).toEqual([0, 0, 0]);
    }, 120_000);
  },
  ['custom-games']
);
