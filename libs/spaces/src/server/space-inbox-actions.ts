import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';

import {
  SpaceInviteCol,
  SPACE_INVITES_TABLE,
} from '@libs/db/shared/space-tables';
import { SpacesError } from '../shared/spaces-errors';
import { joinSpaceServer } from './join-space/join-space-service';
import { deactivateSpaceInviteInteraction } from './spaces-inbox-publish';

export async function acceptSpaceInviteFromInbox(args: {
  readonly sql: SqlClient;
  readonly actorId: string;
  readonly deviceId: string;
  readonly inviteId: string;
}): Promise<void> {
  const rows = await args.sql.query<{
    readonly space_id: string;
    readonly token: string;
    readonly invitee_account_id: string | null;
    readonly revoked_at: string | null;
  }>(
    honey({
      select: [
        SpaceInviteCol.spaceId,
        SpaceInviteCol.token,
        SpaceInviteCol.inviteeAccountId,
        SpaceInviteCol.revokedAt,
      ],
      from: SPACE_INVITES_TABLE.tableName,
      where: ['=', SpaceInviteCol.id, args.inviteId],
      limit: 1,
    })
  );
  const row = rows[0];
  if (row === undefined || row.revoked_at !== null) {
    throw new SpacesError('SPACE_INVITE_INVALID', 'Invite not found');
  }
  if (
    row.invitee_account_id !== null &&
    row.invitee_account_id !== args.actorId
  ) {
    throw new SpacesError('SPACE_FORBIDDEN', 'Invite is not for this account');
  }
  await joinSpaceServer(args.sql, {
    spaceId: row.space_id,
    deviceId: args.deviceId,
    accountId: args.actorId,
    profileId: args.actorId,
    inviteToken: row.token,
  });
  await deactivateSpaceInviteInteraction(args.sql, args.inviteId, args.actorId);
}

export async function declineSpaceInviteFromInbox(args: {
  readonly sql: SqlClient;
  readonly actorId: string;
  readonly inviteId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await args.sql.run(
    honey({
      update: SPACE_INVITES_TABLE.tableName,
      set: { [SpaceInviteCol.revokedAt]: now },
      where: [
        'and',
        ['=', SpaceInviteCol.id, args.inviteId],
        ['=', SpaceInviteCol.inviteeAccountId, args.actorId],
      ],
    })
  );
  await deactivateSpaceInviteInteraction(args.sql, args.inviteId, args.actorId);
}
