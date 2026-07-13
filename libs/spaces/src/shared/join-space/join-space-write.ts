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

/**
 * Atomically consume one invite use. The `use_count < max_uses` guard makes
 * this the single source of truth for the quota, so concurrent accepts of a
 * single-use invite cannot both succeed. Returns `false` when exhausted.
 */
async function consumeInviteUse(
  sql: SqlClient,
  inviteId: string
): Promise<boolean> {
  const now = isoNow();
  const result = await sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.useCount} = ${SpaceInviteCol.useCount} + 1,
         ${SpaceInviteCol.acceptedAt} = COALESCE(${SpaceInviteCol.acceptedAt}, ?)
     WHERE ${SpaceInviteCol.id} = ?
       AND ${SpaceInviteCol.useCount} < ${SpaceInviteCol.maxUses}`,
    [now, inviteId]
  );
  return result.changes > 0;
}

/**
 * Consume a use only when the join relies on the invite and creates/reactivates
 * a seat — idempotent re-joins by an existing member must not burn quota.
 * Consume before writing membership so an exhausted invite blocks the join.
 */
async function consumeInviteForJoinIfNeeded(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly inviteToken: string | null;
  readonly reactivating: boolean;
}): Promise<WriteResult<void>> {
  if (!args.reactivating) return ok(undefined);
  if (args.inviteToken === null || args.inviteToken.length === 0) {
    return ok(undefined);
  }
  const invite = await findValidInviteInStore(
    args.sql,
    args.inviteToken,
    args.spaceId
  );
  if (invite === null) {
    return fail('SPACE_INVITE_EXHAUSTED', 'Invite has already been used up');
  }
  const consumed = await consumeInviteUse(args.sql, invite.inviteId);
  if (!consumed) {
    return fail('SPACE_INVITE_EXHAUSTED', 'Invite has already been used up');
  }
  return ok(undefined);
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
  const membershipId = spaceDeviceMembershipEntityId(
    ctx.deviceId,
    input.spaceId
  );
  const reactivating = await wasMembershipInactive(sql, membershipId);
  const inviteResult = await consumeInviteForJoinIfNeeded({
    sql,
    spaceId: input.spaceId,
    inviteToken: input.inviteToken,
    reactivating,
  });
  if (!inviteResult.ok) return inviteResult;
  const { reactivated } = await upsertJoinMembership(ctx, input, sql);
  if (reactivated) {
    await bumpActiveMemberCount(sql, input.spaceId);
  }
  return ok(undefined);
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: parseJoinSpaceInput,
  authorize: authorizeJoinSpace,
  execute: executeJoinSpace,
});
