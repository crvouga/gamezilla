import { createLogger, type Logger } from '@pkgs/logger';
import { test, type TestInfo } from '@playwright/test';

const ROOT_LOGGER = createLogger({
  name: 'qa.playwright',
  level: process.env['CI'] ? 'info' : 'debug',
});

/** Structured logger scoped to the active Playwright test. */
export function createQaPlaywrightLog(testInfo: TestInfo): Logger {
  return ROOT_LOGGER.child({
    test: testInfo.title,
    project: testInfo.project.name,
    retry: testInfo.retry,
    workerIndex: testInfo.workerIndex,
  });
}

/**
 * Runs `run` inside a Playwright report step and emits structured
 * start/done/failed log lines for CI and local debugging.
 */
export async function playwrightStep<T>(
  log: Logger,
  stepId: string,
  run: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const bindings = { stepId, ...context };
  log.info('step start', bindings);
  try {
    return await test.step(stepId, async () => run());
  } catch (err) {
    log.error('step failed', {
      ...bindings,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    log.info('step done', bindings);
  }
}
