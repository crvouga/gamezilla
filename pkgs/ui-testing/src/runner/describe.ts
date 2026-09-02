import { getUiTestRunner } from './install';
import type { UiTestCtx } from './types';

/**
 * Register a UI scenario suite. Delegates to the installed host runner so the
 * same file runs under Jest (sim / RNTL) or Playwright (max / browser).
 */
export function describe(name: string, fn: (ctx: UiTestCtx) => void): void {
  const runner = getUiTestRunner();
  runner.describe(name, fn);
}
