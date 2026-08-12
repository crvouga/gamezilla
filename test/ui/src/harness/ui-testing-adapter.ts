import type { Handle } from '@libs/dst-handles';
import { by, type Driver } from '@pkgs/ui-testing';

import type { UiPort, UiWaitOptions } from './ui-port';

function waitOpts(options?: UiWaitOptions): { timeoutMs?: number } | undefined {
  if (options?.timeoutMs === undefined) return undefined;
  return { timeoutMs: options.timeoutMs };
}

/**
 * {@link UiPort} over `@pkgs/ui-testing` using `by.testId` only.
 * `tap` / `input` wait until the handle is visible before acting.
 */
export function createUiTestingAdapter(driver: Driver): UiPort {
  const sel = (handle: Handle) => by.testId(handle);

  return {
    async tap(handle, options) {
      await driver.expectVisible(sel(handle), waitOpts(options));
      await driver.tap(sel(handle));
    },
    async input(handle, value, options) {
      await driver.expectVisible(sel(handle), waitOpts(options));
      await driver.input(sel(handle), value);
    },
    async expectVisible(handle, options) {
      await driver.expectVisible(sel(handle), waitOpts(options));
    },
    async expectHidden(handle, options) {
      await driver.expectHidden(sel(handle), waitOpts(options));
    },
    async expectText(handle, text, options) {
      const { exact, timeoutMs } = options ?? {};
      await driver.expectText(sel(handle), text, {
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(exact !== undefined ? { exact } : {}),
      });
    },
    async expectCopy(handle, text, options) {
      await driver.expectText(sel(handle), text, waitOpts(options));
    },
  };
}
