import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { attemptCustomGame } from '@libs/game-session-harness/custom-game-ui';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness/game-history-actions';
import { openGamesHarness } from '@libs/games-harness/games-system';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';

for (const game of HARNESS_GAMES.filter((candidate) =>
  candidate.shared.turnGame.capabilities.includes('history')
)) {
  // regression: cancelled-history-invents-bot
  test(`${game.label}: a cancelled game with an unfilled place records no invented bot or result`, async () => {
    await using s = await openGamesHarness(
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
}
