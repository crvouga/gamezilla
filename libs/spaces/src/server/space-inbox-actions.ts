import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';

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
  }>(sql`SELECT ${raw(SpaceInviteCol.spaceId)} AS space_id,
            ${raw(SpaceInviteCol.token)} AS token,
            ${raw(SpaceInviteCol.inviteeAccountId)} AS invitee_account_id,
            ${raw(SpaceInviteCol.revokedAt)} AS revoked_at
     FROM ${raw(SPACE_INVITES_TABLE.tableName)}
     WHERE ${raw(SpaceInviteCol.id)} = ${args.inviteId}
     LIMIT 1`);
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
  await args.sql.run(sql`UPDATE ${raw(SPACE_INVITES_TABLE.tableName)}
     SET ${raw(SpaceInviteCol.revokedAt)} = ${now}
     WHERE ${raw(SpaceInviteCol.id)} = ${args.inviteId}
       AND ${raw(SpaceInviteCol.inviteeAccountId)} = ${args.actorId}`);
  await deactivateSpaceInviteInteraction(args.sql, args.inviteId, args.actorId);
}
