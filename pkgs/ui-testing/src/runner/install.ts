import type { UiTestRunner } from './types';

let installed: UiTestRunner | undefined;

/** Bind the process-wide host runner (Jest, Playwright, Detox). Call once at setup. */
export function installUiTestRunner(runner: UiTestRunner): void {
  installed = runner;
}

/** Returns the installed runner or throws if setup forgot to install. */
export function getUiTestRunner(): UiTestRunner {
  if (installed === undefined) {
    throw new Error(
      'UiTestRunner not installed — call installUiTestRunner from jest.setup or playwright setup'
    );
  }
  return installed;
}

/** Test-only reset. */
export function resetUiTestRunnerForTests(): void {
  installed = undefined;
}
