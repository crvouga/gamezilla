import { beforeAll, describe, test } from 'bun:test';

import { appLoadsScenario } from '../scenarios/app-loads';
import { chessPuzzleLoopScenario } from '../scenarios/chess-puzzle-loop';
import { webGlobalSetup } from '../web/web-global-setup';
import { withWebApp } from '../web/web-session';

describe('web UI (Playwright driver)', () => {
  beforeAll(async () => {
    await webGlobalSetup();
  }, 240_000);

  test(
    'app loads spaces screen',
    async () => {
      await withWebApp(appLoadsScenario);
    },
    { timeout: 120_000 }
  );

  // Ported but kept skipped — was flaky under the previous Playwright runner.
  test.skip(
    'chess puzzle loop: solve puzzles, elo summary, stats',
    async () => {
      await withWebApp(chessPuzzleLoopScenario, { path: '/?reset-db=1' });
    },
    { timeout: 360_000 }
  );
});
