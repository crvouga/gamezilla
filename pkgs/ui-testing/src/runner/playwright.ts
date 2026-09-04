import { test as pwTest } from '@playwright/test';

import { createUiTestCtx } from './create-ctx';
import { runWithUiTestHostStateAsync } from './host-state';
import { installUiTestRunner } from './install';
import type {
  UiTestHostHooks,
  UiTestRunner,
  UiTestRunnerConfig,
} from './types';

function createPlaywrightHostHooks(): UiTestHostHooks {
  return {
    describe(name, fn) {
      pwTest.describe(name, fn);
    },
    test(name, fn, timeoutMs) {
      pwTest(name, async (args) => {
        if (timeoutMs !== undefined) {
          pwTest.setTimeout(timeoutMs);
        }
        await runWithUiTestHostStateAsync(
          { browser: args.browser },
          async () => {
            await fn();
          }
        );
      });
    },
    beforeAll(fn) {
      pwTest.beforeAll(fn);
    },
    afterAll(fn) {
      pwTest.afterAll(fn);
    },
    beforeEach(fn) {
      pwTest.beforeEach(fn);
    },
    afterEach(fn) {
      pwTest.afterEach(fn);
    },
  };
}

/** Playwright Test adapter for `fidelity: 'max'` / browser tabs. */
export function createPlaywrightUiTestRunner(
  config: UiTestRunnerConfig
): UiTestRunner {
  const hooks = createPlaywrightHostHooks();
  return {
    config,
    describe(name, fn) {
      hooks.describe(name, () => {
        fn(createUiTestCtx(config, hooks));
      });
    },
  };
}

/** Install Playwright adapter — call from product/test playwright setup (worker-loaded). */
export function installPlaywrightUiTestRunner(
  config: UiTestRunnerConfig = {
    fidelity: 'max',
    driverKind: 'playwright',
  }
): UiTestRunner {
  const runner = createPlaywrightUiTestRunner(config);
  installUiTestRunner(runner);
  return runner;
}
