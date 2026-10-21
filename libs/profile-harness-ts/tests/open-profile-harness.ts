import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness-ts/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing-harness-ts/billing-harness-slice';
import { defineProductSystem } from '@libs/harness-ts/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { openHarness as openSystemHarness } from '@libs/harness-ts/open-harness';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import { PROFILE_HARNESS_SLICE } from '@libs/profile-harness-ts/profile-harness-slice';

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

/** Privacy traces control export worker completion and use sessions valid for their whole retention experiment. */
const PROFILE_QUINT_SYSTEM = defineProductSystem({
  ...composeHarnessSlices('profile-quint', [
    {
      ...ACCOUNT_PRIVACY_HARNESS_SLICE,
      server: (deps) =>
        createAccountPrivacyServer(
          deps.app.accountPrivacy,
          deps.rooms,
          'on-demand'
        ),
    },
    PROFILE_HARNESS_SLICE,
    BILLING_HARNESS_SLICE,
  ]),
  authProvider: inhouseAuthProvider(10 * 365 * 86_400_000),
});

export function openQuintHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(PROFILE_QUINT_SYSTEM, testId, options);
}

import { createAccountPrivacyServer } from '@libs/account-privacy-server-ts/sub-server';
import { inhouseAuthProvider } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
