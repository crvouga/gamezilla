import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { SpaceInviteKind } from '../shared/space-invite-types';
import { spacesApiJson, type SpacesApiFetch } from './spaces-api';

export type SpacesClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: SpacesApiFetch;
};

export type SpacePeekDto = {
  readonly spaceId: string;
  readonly title: string | null;
  readonly visibility: string;
  readonly ended: boolean;
  readonly hostAccountId: string | null;
  readonly hostUsername: string | null;
  readonly hostAvatarConfig: string | null;
  readonly activeMemberCount: number;
  readonly joinable: boolean;
  readonly joinDeniedCode: string | null;
  readonly requiresInvite: boolean;
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

export async function peekSpace(
  deps: SpacesClientDeps,
  spaceId: string,
  inviteToken?: string | null
): Promise<SpacePeekDto> {
  const qs =
    inviteToken !== null &&
    inviteToken !== undefined &&
    inviteToken.length > 0
      ? `?invite=${encodeURIComponent(inviteToken)}`
      : '';
  const body = await spacesApiJson<{ peek: SpacePeekDto }>({
    ...deps,
    path: `/spaces/${encodeURIComponent(spaceId)}/peek${qs}`,
    init: { method: 'GET' },
  });
  return body.peek;
}

export async function joinSpaceRemote(
  deps: SpacesClientDeps,
  args: {
    readonly spaceId: string;
    readonly deviceLabel: string;
    readonly inviteToken?: string | null;
  }
): Promise<void> {
  await spacesApiJson<{ ok: true }>({
    ...deps,
    path: '/spaces/join',
    init: {
      method: 'POST',
      body: JSON.stringify({
        spaceId: args.spaceId,
        deviceLabel: args.deviceLabel,
        inviteToken: args.inviteToken ?? null,
      }),
    },
  });
}

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
