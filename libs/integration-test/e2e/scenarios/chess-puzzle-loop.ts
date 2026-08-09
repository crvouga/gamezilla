import { wallIo } from '@pkgs/io';
import { by, expectVisible, first, waitUntil } from '@pkgs/ui-testing';

import { createE2eLog, e2eStep } from '../../src/e2e-step';
import { expectAppBooted } from '../support/app-boot';
import { createChessDSL } from '../support/chess/chess-dsl';
import type { TestApp } from '../support/test-app';

const io = wallIo();

/**
 * Driver-agnostic chess puzzle loop.
 * Kept skipped at the target binding until flakiness is addressed.
 */
export async function chessPuzzleLoopScenario(app: TestApp): Promise<void> {
  const log = createE2eLog('chess puzzle loop');
  const chess = createChessDSL(app);
  const { driver } = app;

  await e2eStep(log, 'boot: app shell ready', () => expectAppBooted(app));
  await e2eStep(log, 'auth: sign in', () => app.auth.signIn());

  await e2eStep(log, 'chess: enter space with games', () =>
    chess.enterSpaceWithGames()
  );
  await e2eStep(log, 'chess: open puzzle play', () => chess.openChessPuzzle());

  for (let i = 0; i < 2; i += 1) {
    await e2eStep(log, `chess: solve puzzle ${String(i + 1)}`, () =>
      chess.solveCurrentPuzzle()
    );
    await e2eStep(log, `chess: assert summary ${String(i + 1)}`, async () => {
      await expectVisible(driver, by.testId('chess-puzzle-summary'), {
        timeoutMs: 30_000,
      });
      await waitUntil(
        async () => {
          const text = await driver.getText(by.testId('chess-puzzle-summary'));
          return text !== null && /[+-]?\d+/.test(text);
        },
        {
          timeoutMs: 30_000,
          description: 'summary contains elo delta',
          now: io.clock.now,
          timers: io.timers,
        }
      );
    });
    if (i < 1) {
      await e2eStep(log, `chess: continue ${String(i + 1)}`, () =>
        chess.continueFromSummary()
      );
      await expectVisible(driver, by.testId('chess-puzzle-board'), {
        timeoutMs: 60_000,
      });
      await expectVisible(driver, by.testId('chess-puzzle-board-elo'));
    }
  }

  await e2eStep(log, 'chess: open stats screen', async () => {
    await driver.tap(by.role('button', 'Back'));
    await chess.openStats();
  });

  await e2eStep(log, 'chess: stats screen populated', async () => {
    await expectVisible(driver, by.testId('chess-stats-elo'));
    await expectVisible(driver, by.testId('chess-stats-sparkline'));
    await expectVisible(driver, first(by.testId('chess-game-log-row')));
  });
}
