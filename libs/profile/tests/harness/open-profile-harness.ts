import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy/harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing/harness/billing-harness-slice';
import {
  type OpenHarness,
  type OpenHarnessOptions,
  openHarness as openSystemHarness,
} from '@libs/harness/open-harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';
import { defineProductSystem } from '@libs/harness/system/define-product-system';
import { PROFILE_HARNESS_SLICE } from '@libs/profile/harness/profile-harness-slice';

/**
 * Profile on the platform: the Profile tab (the shell's home tab, which the
 * auth flows return to) and username / avatar editing. It also hosts the auth
 * specs, since auth is platform and the harness itself depends on it. Billing
 * is in because permissions reads its `billing_subscriptions` rows directly
 * (see README.md).
 */
const PROFILE_SYSTEM = defineProductSystem(
  composeHarnessSlices('profile', [
      ACCOUNT_PRIVACY_HARNESS_SLICE,
    PROFILE_HARNESS_SLICE,
    BILLING_HARNESS_SLICE,
  ])
);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(PROFILE_SYSTEM, testId, options);
}
