import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy/harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing/harness/billing-harness-slice';
import {
  type OpenHarness,
  type OpenHarnessOptions,
  openHarness as openSystemHarness,
} from '@libs/harness/open-harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';
import { defineProductSystem } from '@libs/harness/system/define-product-system';

/**
 * Billing on the platform alone: sign-in, the settings menu that reaches the
 * billing screen and the payment provider node's hosted pages come from the platform
 * slices plus billing's own (the harness lands on its bare home screen, since
 * nothing here owns `/`). No profile, spaces or games: profile devDepends on
 * billing for its own spec, and a change anywhere else leaves this cached.
 */
const BILLING_SYSTEM = defineProductSystem(
  composeHarnessSlices('billing', [
    ACCOUNT_PRIVACY_HARNESS_SLICE,
    BILLING_HARNESS_SLICE,
  ])
);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(BILLING_SYSTEM, testId, options);
}
