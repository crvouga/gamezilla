import { BILLING_LIFECYCLE_PROPERTIES } from '@libs/billing/sim/billing-lifecycle-properties';
import { billingStimulus } from '@libs/billing/sim/billing-lifecycle-walk';
import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
import {
  type OpenSim,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';
import { composeSimSlices } from '@libs/sim-harness/slices';
import { defineProductSystem } from '@libs/sim-harness/system/define-product-system';

/**
 * Billing's composition plus the lifecycle walk and its standing properties.
 * Kept out of the billing slice itself so other suites' monkeys and the
 * whole-app explore do not pay for the provider reads every checkpoint makes.
 */
const BILLING_LIFECYCLE_SYSTEM = defineProductSystem(
  composeSimSlices('billing', [
    {
      ...BILLING_SIM_SLICE,
      properties: [
        ...(BILLING_SIM_SLICE.properties ?? []),
        ...BILLING_LIFECYCLE_PROPERTIES,
      ],
      actions: [...(BILLING_SIM_SLICE.actions ?? []), billingStimulus],
    },
  ])
);

export function openLifecycleSim(
  testId: string,
  seed: number
): Promise<OpenSim> {
  return openHarnessSim(BILLING_LIFECYCLE_SYSTEM, testId, { seed });
}
