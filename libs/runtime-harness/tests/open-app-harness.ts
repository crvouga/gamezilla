import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { openHarness as openSystemHarness } from '@libs/harness/open-harness';
import { APP_SYSTEM } from '@libs/runtime-harness/app-composition';

/**
 * Open a reported harness of the full composition: every sub, folded exactly
 * as production folds them, migrated by the production runner. Only the
 * whole-app suite runs this — it reruns for every sub change, by design.
 */
export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(APP_SYSTEM, testId, options);
}
