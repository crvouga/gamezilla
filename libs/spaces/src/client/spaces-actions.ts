import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { SpaceInviteKind } from '../shared/space-invite-types';
import { spacesApiJson, type SpacesApiFetch } from './spaces-api';

export type SpacesClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: SpacesApiFetch;
};

export type SpaceInviteDto = {
  readonly id: string;
  readonly spaceId: string;
  readonly kind: SpaceInviteKind;
  readonly token: string;
  readonly code: string | null;
  readonly expiresAt: string | null;
  readonly inviteeAccountId: string | null;
};

export async function ensureSpaceLinkInvite(
  deps: SpacesClientDeps,
  spaceId: string
): Promise<SpaceInviteDto> {
  const body = await spacesApiJson<{ invite: SpaceInviteDto }>({
    ...deps,
    path: '/spaces/invites/link',
    init: {
      method: 'POST',
      body: JSON.stringify({ spaceId }),
    },
  });
  return body.invite;
}

export async function createSpaceInvite(
  deps: SpacesClientDeps,
  args: {
    readonly spaceId: string;
    readonly kind: SpaceInviteKind;
    readonly inviteeAccountId?: string;
  }
): Promise<SpaceInviteDto> {
  const body = await spacesApiJson<{ invite: SpaceInviteDto }>({
    ...deps,
    path: '/spaces/invites',
    init: {
      method: 'POST',
      body: JSON.stringify({
        spaceId: args.spaceId,
        kind: args.kind,
        inviteeAccountId: args.inviteeAccountId,
      }),
    },
  });
  return body.invite;
}
