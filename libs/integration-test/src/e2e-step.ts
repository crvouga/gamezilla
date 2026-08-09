// @io-wall-ok
import { wallIo } from '@pkgs/io';
import { createLogger, type Logger } from '@pkgs/logger';

const io = wallIo();
const ROOT_LOGGER = createLogger({
  name: 'integration-test.e2e',
  level: process.env['CI'] ? 'info' : 'debug',
  now: io.clock.now,
});

/** Structured logger scoped to the active E2E test. */
export function createE2eLog(testTitle: string): Logger {
  return ROOT_LOGGER.child({ test: testTitle });
}

/**
 * Runs `run` and emits structured start/done/failed log lines for CI and
 * local debugging. Runner-agnostic (no Playwright `test.step`).
 */
export async function e2eStep<T>(
  log: Logger,
  stepId: string,
  run: () => Promise<T>
): Promise<T> {
  const bindings = { stepId };
  log.info('step start', bindings);
  try {
    return await run();
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
