import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe as jestDescribe,
  test as jestTest,
} from '@jest/globals';

import { createUiTestCtx } from './create-ctx';
import { installUiTestRunner } from './install';
import type {
  UiTestHostHooks,
  UiTestRunner,
  UiTestRunnerConfig,
} from './types';

function createDetoxHostHooks(): UiTestHostHooks {
  return {
    describe(name, fn) {
      jestDescribe(name, fn);
    },
    test(name, fn, timeoutMs) {
      if (timeoutMs !== undefined) {
        jestTest(name, fn, timeoutMs);
      } else {
        jestTest(name, fn);
      }
    },
    beforeAll(fn) {
      beforeAll(fn);
    },
    afterAll(fn) {
      afterAll(fn);
    },
    beforeEach(fn) {
      beforeEach(fn);
    },
    afterEach(fn) {
      afterEach(fn);
    },
  };
}

/** Jest-shaped adapter reserved for future native Detox fidelity. */
export function createDetoxUiTestRunner(
  config: UiTestRunnerConfig = { fidelity: 'max', driverKind: 'detox' }
): UiTestRunner {
  const hooks = createDetoxHostHooks();
  return {
    config,
    describe(name, fn) {
      hooks.describe(name, () => {
        fn(createUiTestCtx(config, hooks));
      });
    },
  };
}

/** Install Detox adapter stub — no product Detox config yet. */
export function installDetoxUiTestRunner(
  config?: UiTestRunnerConfig
): UiTestRunner {
  const runner = createDetoxUiTestRunner(
    config ?? { fidelity: 'max', driverKind: 'detox' }
  );
  installUiTestRunner(runner);
  return runner;
}
