import {
  deactivateInteraction,
  publishInteraction,
  type PublishInteractionInput,
} from '@pkgs/inbox/server/publish';
import { readProfileCardById } from '@libs/profile/server/read-profile';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Sounds } from '@pkgs/sounds/sound-id';

const SPACES_NAMESPACE = 'spaces' as const;
const SPACE_INVITE_TYPE = 'space-invite' as const;

function spaceInviteSource(inviteId: string) {
  return {
    namespace: SPACES_NAMESPACE,
    type: SPACE_INVITE_TYPE,
    id: inviteId,
  };
}

function formatUsernameLabel(username: string): string {
  if (username.length === 0) return 'Someone';
  return `@${username}`;
}

export async function publishSpaceInviteInteraction(
  sql: SqlClient,
  args: {
    readonly inviteId: string;
    readonly spaceId: string;
    readonly token: string;
    readonly inviteeAccountId: string;
    readonly hostAccountId: string;
    readonly spaceTitle: string | null;
  }
): Promise<void> {
  const host = await readProfileCardById(sql, args.hostAccountId);
  const username = host?.username ?? '';
  const label = formatUsernameLabel(username);
  const title =
    args.spaceTitle !== null && args.spaceTitle.length > 0
      ? `${label} invited you to ${args.spaceTitle}`
      : `${label} invited you to a space`;
  const input: PublishInteractionInput = {
    userId: args.inviteeAccountId,
    source: spaceInviteSource(args.inviteId),
    category: 'action_required',
    presentation: {
      title,
      ...(username.length > 0 ? { subtitle: label } : {}),
      avatar: {
        fallbackLabel: label,
        avatarConfig: host?.avatarConfig ?? null,
      },
      deepLink: {
        path: '/space/[id]',
        params: {
          id: args.spaceId,
          invite: args.token,
        },
      },
    },
    actions: [
      {
        id: 'accept',
        label: 'Join',
        variant: 'solid',
        soundKey: Sounds.social.roomJoined,
      },
      {
        id: 'decline',
        label: 'Decline',
        variant: 'outline',
        destructive: true,
      },
    ],
    payload: {
      inviteId: args.inviteId,
      spaceId: args.spaceId,
      token: args.token,
      hostAccountId: args.hostAccountId,
    },
    groupKey: 'spaces:invites',
    priority: 12,
  };
  await publishInteraction(sql, input);
}

export async function deactivateSpaceInviteInteraction(
  sql: SqlClient,
  inviteId: string,
  inviteeAccountId: string
): Promise<void> {
  await deactivateInteraction(sql, {
    userId: inviteeAccountId,
    source: spaceInviteSource(inviteId),
  });
}
