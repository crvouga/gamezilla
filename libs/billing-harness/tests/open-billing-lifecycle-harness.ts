import { BILLING_HARNESS_SLICE } from '@libs/billing-harness/billing-harness-slice';
import { BILLING_LIFECYCLE_PROPERTIES } from '@libs/billing-harness/billing-lifecycle-properties';
import { billingStimulus } from '@libs/billing-harness/billing-lifecycle-stimuli';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { openHarness as openSystemHarness } from '@libs/harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';

/**
 * Billing's composition plus the lifecycle stimuli and their standing
 * properties. Kept out of the billing slice itself so other suites and the
 * whole-app explore do not pay for the provider reads every checkpoint makes.
 */
const BILLING_LIFECYCLE_SYSTEM = defineProductSystem(
  composeHarnessSlices('billing', [
    {
      ...BILLING_HARNESS_SLICE,
      properties: [
        ...(BILLING_HARNESS_SLICE.properties ?? []),
        ...BILLING_LIFECYCLE_PROPERTIES,
      ],
      actions: [...(BILLING_HARNESS_SLICE.actions ?? []), billingStimulus],
    },
  ])
);

export function openLifecycleHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(BILLING_LIFECYCLE_SYSTEM, testId, options);
}
