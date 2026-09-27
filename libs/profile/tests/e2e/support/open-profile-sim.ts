import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
import { PROFILE_SIM_SLICE } from '@libs/profile/sim/profile-sim-slice';
import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';
import { composeSimSlices } from '@libs/sim-harness/slices';
import { defineProductSystem } from '@libs/sim-harness/system/define-product-system';

/**
 * Profile on the platform: the Profile tab (the shell's home tab, which the
 * auth flows return to) and username / avatar editing. It also hosts the auth
 * specs, since auth is platform and the harness itself depends on it. Billing
 * is in because permissions reads its `billing_subscriptions` rows directly
 * (see docs/FEATURE_SUBSYSTEMS.md).
 */
const PROFILE_SYSTEM = defineProductSystem(
  composeSimSlices('profile', [PROFILE_SIM_SLICE, BILLING_SIM_SLICE])
);

export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(PROFILE_SYSTEM, testId, options);
}
