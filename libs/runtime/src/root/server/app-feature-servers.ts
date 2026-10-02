/**
 * The server half of the composition root: which bounded contexts this
 * product's API runs, and what each of them needs from the host.
 *
 * Features that need a host service — billing needs the membership provider —
 * are factories over it rather than constants, so the same feature runs
 * against real providers in production and a mock in a simulation without knowing
 * which it got.
 */

import { createAccountPrivacyServer } from '@libs/account-privacy/root/server/feature-server';
import { createBillingServer } from '@libs/billing/root/server/feature-server';
import type { FeatureServer } from '@libs/feature/public/server';
import { FRIENDS_SERVER } from '@libs/friends/root/server/feature-server';
import { NOTIFICATIONS_SERVER } from '@libs/notifications/root/server/feature-server';
import { SPACES_SERVER } from '@libs/spaces/root/server/feature-server';
import type { MembershipProviders } from '@pkgs/billing';
import { APP } from '../app-features';

export type AppFeatureServerDeps = {
  readonly billing: MembershipProviders | null;
};

export function appFeatureServers(
  deps: AppFeatureServerDeps
): readonly FeatureServer[] {
  return [
    createAccountPrivacyServer(APP.accountPrivacy),
    SPACES_SERVER,
    // Friends registers the inbox actions its deliveries carry, so it is
    // composed before the inbox that serves them.
    FRIENDS_SERVER,
    NOTIFICATIONS_SERVER,
    createBillingServer(deps.billing),
  ];
}
