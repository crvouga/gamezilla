import {
  type OpenHarness,
  type OpenHarnessOptions,
  openHarness as openSystemHarness,
} from '@libs/harness/open-harness/open-harness';
import { APP_SYSTEM } from '@libs/runtime/harness/app-composition';

/**
 * Open a reported harness of the full composition: every feature, folded exactly
 * as production folds them, migrated by the production runner. Only the
 * whole-app suite runs this — it reruns for every feature change, by design.
 */
export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(APP_SYSTEM, testId, options);
}

export type { OpenHarness, OpenHarnessOptions };
