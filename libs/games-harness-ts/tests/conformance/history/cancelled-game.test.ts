/**
 * The shared history of every game offering it records what happened to a
 * game session, and nothing that did not.
 */

import { expect, test } from 'bun:test';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness-ts/game-history-actions';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import { attemptGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    // regression: cancelled-history-invents-bot
    test('a cancelled game with an unfilled place records no invented bot or result', async () => {
      await using s = await openConformanceHarness();
      await s.apply(establishGameSession, game.shared.id, {
        second: 'open',
        active: false,
      });
      await s.apply(attemptGameSession, 'alice', { operation: 'cancel' });
      await s.apply(openGameHistory, 'alice');
      const history = await s.read(gameHistoryStatistics, 'alice');
      expect(history.record).toContain('Nobody else joined');
      expect(history.record).toContain('Cancelled before the first move');
      expect(history.record).not.toContain('Bot');
      expect([history.wins, history.losses, history.draws]).toEqual([0, 0, 0]);
    }, 120_000);
  },
  ['vs-human', 'two seats']
);
