/**
 * The server half of the composition root: which bounded contexts this
 * product's API runs, and what each of them needs from the host.
 *
 * Features that need a host service — billing needs the membership provider —
 * are factories over it rather than constants, so the same feature runs
 * against real providers in production and a mock in a simulation without knowing
 * which it got.
 */

import { createAccountPrivacyServer } from '@libs/account-privacy-server/feature-server';
import { createBillingServer } from '@libs/billing-server/feature-server';
import { createChessServer } from '@libs/chess-root-server/feature-server';
import type { FeatureServer } from '@libs/feature-shared/server';
import { FRIENDS_SERVER } from '@libs/friends-server/feature-server';
import { FRIENDS_BLOCK_RELATION } from '@libs/friends-shared/block-relation';
import { NOTIFICATIONS_SERVER } from '@libs/notifications-server/feature-server';
import { APP } from '@libs/runtime-shared/app-features';
import { createSpacesServer } from '@libs/spaces-server/feature-server';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';

export type AppFeatureServerDeps = {
  readonly rooms: RoomServicePort;
  readonly billing: MembershipProviders | null;
};

export function appFeatureServers(
  deps: AppFeatureServerDeps
): readonly FeatureServer[] {
  return [
    createAccountPrivacyServer(APP.accountPrivacy, deps.rooms),
    createSpacesServer(deps.rooms, FRIENDS_BLOCK_RELATION),
    createChessServer(deps.rooms),
    // Friends registers the inbox actions its deliveries carry, so it is
    // composed before the inbox that serves them.
    FRIENDS_SERVER,
    NOTIFICATIONS_SERVER,
    createBillingServer(deps.billing),
  ];
}
