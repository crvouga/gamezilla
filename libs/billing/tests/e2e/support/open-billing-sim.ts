import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';
import { composeSimSlices } from '@libs/sim-harness/slices';
import { defineProductSystem } from '@libs/sim-harness/system/define-product-system';

/**
 * Billing on the platform alone: sign-in, the settings menu that reaches the
 * billing screen and the mock provider's hosted pages come from the platform
 * slices plus billing's own (the harness lands on its bare home screen, since
 * nothing here owns `/`). No profile, spaces or games: profile devDepends on
 * billing for its own e2e, and a change anywhere else leaves this cached.
 */
const BILLING_SYSTEM = defineProductSystem(
  composeSimSlices('billing', [BILLING_SIM_SLICE])
);

export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(BILLING_SYSTEM, testId, options);
}
