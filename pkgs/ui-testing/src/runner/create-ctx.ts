import type { UiTestCtx, UiTestHostHooks, UiTestRunnerConfig } from './types';

/** Build the describe-scoped ctx from runner config + host hooks. */
export function createUiTestCtx(
  config: UiTestRunnerConfig,
  hooks: UiTestHostHooks
): UiTestCtx {
  return {
    fidelity: config.fidelity,
    driverKind: config.driverKind,
    test(name, fn, timeoutMs) {
      hooks.test(name, fn, timeoutMs);
    },
    beforeAll(fn) {
      hooks.beforeAll(fn);
    },
    afterAll(fn) {
      hooks.afterAll(fn);
    },
    beforeEach(fn) {
      hooks.beforeEach(fn);
    },
    afterEach(fn) {
      hooks.afterEach(fn);
    },
  };
}
