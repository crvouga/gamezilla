import { expect, test } from '@playwright/test';

import {
  createQaPlaywrightLog,
  playwrightStep,
} from '../../../src/playwright-step';

import { createAppSession } from '../../session/app-session';

test.skip('chess puzzle loop: solve puzzles, elo summary, stats', async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000);
  const log = createQaPlaywrightLog(testInfo);
  const app = createAppSession(page);

  await playwrightStep(log, 'boot: app shell ready', () => app.expectBooted());
  await playwrightStep(log, 'auth: sign in with Clerk', () =>
    app.auth.signIn()
  );

  await playwrightStep(log, 'chess: enter space with games', () =>
    app.chess.enterSpaceWithGames()
  );
  await playwrightStep(log, 'chess: open puzzle play', () =>
    app.chess.openChessPuzzle()
  );

  const eloBefore = await page
    .getByTestId('chess-puzzle-player-elo')
    .textContent();

  for (let i = 0; i < 2; i += 1) {
    await playwrightStep(log, `chess: solve puzzle ${i + 1}`, () =>
      app.chess.solveCurrentPuzzle()
    );
    await playwrightStep(log, `chess: assert summary ${i + 1}`, async () => {
      const summary = page.getByTestId('chess-puzzle-summary');
      await expect(summary).toBeVisible({ timeout: 30_000 });
      await expect(summary).toContainText(/[+-]?\d+/);
    });
    if (i < 1) {
      await playwrightStep(log, `chess: continue ${i + 1}`, () =>
        app.chess.continueFromSummary()
      );
      await expect(page.getByTestId('chess-puzzle-board')).toBeVisible({
        timeout: 60_000,
      });
    }
  }

  await playwrightStep(log, 'chess: elo chip updated', async () => {
    const eloAfter = await page
      .getByTestId('chess-puzzle-player-elo')
      .textContent();
    expect(eloAfter).not.toBe(eloBefore);
  });

  await playwrightStep(log, 'chess: open stats screen', async () => {
    await page.getByRole('button', { name: 'Back' }).click();
    await app.chess.openStats();
  });

  await playwrightStep(log, 'chess: stats screen populated', async () => {
    await expect(page.getByTestId('chess-stats-elo')).toBeVisible();
    await expect(page.getByTestId('chess-stats-sparkline')).toBeVisible();
    await expect(page.getByTestId('chess-game-log-row').first()).toBeVisible();
  });
});
