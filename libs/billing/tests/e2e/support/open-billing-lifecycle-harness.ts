import { BILLING_HARNESS_SLICE } from '@libs/billing/harness/billing-harness-slice';
import { BILLING_LIFECYCLE_PROPERTIES } from '@libs/billing/harness/billing-lifecycle-properties';
import { billingStimulus } from '@libs/billing/harness/billing-lifecycle-stimuli';
import {
  type OpenHarness,
  type OpenHarnessOptions,
  openHarness as openSystemHarness,
} from '@libs/harness/open-harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';
import { defineProductSystem } from '@libs/harness/system/define-product-system';

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
