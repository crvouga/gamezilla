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

function createJestHostHooks(): UiTestHostHooks {
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

/** Jest + jest-expo adapter for `fidelity: 'sim'` / `RntlDriver`. */
export function createJestUiTestRunner(
  config: UiTestRunnerConfig
): UiTestRunner {
  const hooks = createJestHostHooks();
  return {
    config,
    describe(name, fn) {
      hooks.describe(name, () => {
        fn(createUiTestCtx(config, hooks));
      });
    },
  };
}

/** Install Jest adapter — call from product/test jest.setup. */
export function installJestUiTestRunner(
  config: UiTestRunnerConfig = { fidelity: 'sim', driverKind: 'rntl' }
): UiTestRunner {
  const runner = createJestUiTestRunner(config);
  installUiTestRunner(runner);
  return runner;
}
