import { TURN_GAMES } from '@libs/game-catalog-shared-ts/turn-games';
import { gamePuzzleServers } from '@libs/game-puzzle-shared-ts/puzzle-sub-server';
import { createGameSessionServer } from '@libs/game-session-server-ts/sub-server';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
/**
 * The server half of the composition root: which bounded contexts this
 * product's API runs, and what each of them needs from the host.
 *
 * Subs that need a host service — billing needs the membership provider —
 * are factories over it rather than constants, so the same sub runs
 * against real providers in production and a mock in a simulation without knowing
 * which it got.
 */

import { createAccountPrivacyServer } from '@libs/account-privacy-server-ts/sub-server';
import { AUTH_SERVER } from '@libs/auth-server-ts/sub-server';
import { createBillingServer } from '@libs/billing-server-ts/sub-server';
import { createChessServer } from '@libs/chess-root-server-ts/sub-server';
import { FRIENDS_SERVER } from '@libs/friends-server-ts/sub-server';
import { FRIENDS_BLOCK_RELATION } from '@libs/friends-shared-ts/block-relation';
import { NOTIFICATIONS_SERVER } from '@libs/notifications-server-ts/sub-server';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { createSpacesServer } from '@libs/spaces-server-ts/sub-server';
import type { SubServer } from '@libs/sub-shared-ts/server';
import { SYNTHETIC_POPULATION_SERVER } from '@libs/synthetic-population-server-ts/sub-server';
import type { MembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';

export type AppSubServerDeps = {
  readonly rooms: RoomServicePort;
  readonly billing: MembershipProviders | null;
};

export function appSubServers(deps: AppSubServerDeps): readonly SubServer[] {
  return [
    AUTH_SERVER,
    createAccountPrivacyServer(APP.accountPrivacy, deps.rooms),
    createSpacesServer(deps.rooms, FRIENDS_BLOCK_RELATION),
    ...gamePuzzleServers(GAME_DEFINITIONS),
    createChessServer(),
    createGameSessionServer(deps.rooms, TURN_GAMES),
    // Friends registers the inbox actions its deliveries carry, so it is
    // composed before the inbox that serves them.
    FRIENDS_SERVER,
    NOTIFICATIONS_SERVER,
    SYNTHETIC_POPULATION_SERVER,
    createBillingServer(deps.billing),
  ];
}
