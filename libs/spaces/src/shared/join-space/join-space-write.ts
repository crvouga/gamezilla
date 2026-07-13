import {
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  authorizeJoinSpaceAccess,
  findValidInviteInStore,
} from './join-space-access';
import {
  asObjectRecord,
  isoNow,
  requireNonEmptyString,
} from '../space-write-helpers';

export type JoinSpaceInput = {
  readonly spaceId: string;
  readonly deviceLabel: string;
  readonly inviteToken: string | null;
};

function parseOptionalInviteToken(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseJoinSpaceInput(raw: unknown): WriteResult<JoinSpaceInput> {
  const record = asObjectRecord(raw, 'join space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const deviceLabelRaw = record.value['deviceLabel'];
  if (typeof deviceLabelRaw !== 'string' || deviceLabelRaw.trim().length === 0) {
    return fail('INVALID_INPUT', 'deviceLabel is required');
  }
  return ok({
    spaceId: spaceId.value,
    deviceLabel: deviceLabelRaw.trim(),
    inviteToken: parseOptionalInviteToken(record.value['inviteToken']),
  });
}

async function wasMembershipInactive(
  sql: SqlClient,
  membershipId: string
): Promise<boolean> {
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const prev = rows[0];
  return prev === undefined || prev.left_at !== null;
}

async function upsertJoinMembership(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient
): Promise<{ readonly reactivated: boolean }> {
  const membershipId = spaceDeviceMembershipEntityId(
    ctx.deviceId,
    input.spaceId
  );
  const reactivated = await wasMembershipInactive(sql, membershipId);
  const now = isoNow();
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.guestId},
      ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
      ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId},
      ${SpaceMembershipCol.deviceLabel})
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       left_at = NULL,
       joined_at = excluded.joined_at,
       profile_id = excluded.profile_id,
       device_label = excluded.device_label`,
    [
      membershipId,
      ctx.deviceId,
      input.spaceId,
      now,
      ctx.myId,
      input.deviceLabel,
    ]
  );
  return { reactivated };
}

async function bumpActiveMemberCount(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.activeMemberCount} = ${SpaceCol.activeMemberCount} + 1
     WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
}

async function bumpInviteUseIfPresent(
  sql: SqlClient,
  spaceId: string,
  inviteToken: string | null
): Promise<void> {
  if (inviteToken === null || inviteToken.length === 0) return;
  const invite = await findValidInviteInStore(sql, inviteToken, spaceId);
  if (invite === null) return;
  const now = isoNow();
  await sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.useCount} = ${SpaceInviteCol.useCount} + 1,
         ${SpaceInviteCol.acceptedAt} = COALESCE(${SpaceInviteCol.acceptedAt}, ?)
     WHERE ${SpaceInviteCol.id} = ?`,
    [now, invite.inviteId]
  );
}

export async function authorizeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient
): Promise<WriteResult<void>> {
  return authorizeJoinSpaceAccess(ctx, sql, input.spaceId, input.inviteToken);
}

export async function executeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient
): Promise<WriteResult<void>> {
  const { reactivated } = await upsertJoinMembership(ctx, input, sql);
  if (reactivated) {
    await bumpActiveMemberCount(sql, input.spaceId);
  }
  await bumpInviteUseIfPresent(sql, input.spaceId, input.inviteToken);
  return ok(undefined);
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: parseJoinSpaceInput,
  authorize: authorizeJoinSpace,
  execute: executeJoinSpace,
});
