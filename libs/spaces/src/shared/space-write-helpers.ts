import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  decideEndSpace,
  isSpaceHostActor,
} from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { readOne } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export function isoNow(): string {
  return new Date().toISOString();
}

export function memberIdFromContext(ctx: WriteContext): string {
  return resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
}

export type SpaceHostEnded = {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly hostAccountId: string | null;
  readonly endedAt: string | null;
};

export async function readSpaceHostEnded(
  sql: SqlClient,
  spaceId: string
): Promise<WriteResult<SpaceHostEnded>> {
  const result = await readOne<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly ended_at: string | null;
  }>(
    sql,
    `SELECT ${SpaceCol.hostId}, ${SpaceCol.hostMemberId},
            ${SpaceCol.hostAccountId}, ${SpaceCol.endedAt}
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ? LIMIT 1`,
    [spaceId],
    'SPACE_NOT_FOUND'
  );
  if (!result.ok) return result;
  const hostId = result.value.host_id;
  if (hostId === null || hostId.length === 0) {
    return fail('SPACE_NOT_FOUND', 'Space not found');
  }
  const hostMemberId =
    result.value.host_member_id ?? result.value.host_account_id ?? hostId;
  if (hostMemberId.length === 0) {
    return fail('SPACE_NOT_FOUND', 'Space not found');
  }
  return ok({
    hostId,
    hostMemberId,
    hostAccountId: result.value.host_account_id,
    endedAt: result.value.ended_at,
  });
}

export async function authorizeSpaceHost(
  ctx: WriteContext,
  sql: SqlClient,
  spaceId: string,
  deniedMessage: string
): Promise<WriteResult<void>> {
  const space = await readSpaceHostEnded(sql, spaceId);
  if (!space.ok) return space;
  const memberId = memberIdFromContext(ctx);
  const decision = decideEndSpace({
    isHostActor: isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId,
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    }),
  });
  // decideEndSpace encodes host check; reuse for all host mutations.
  if (!decision.allowed) {
    return fail('SPACE_HOST_REQUIRED', deniedMessage);
  }
  return ok(undefined);
}

export type MembershipLeaveRow = {
  readonly leftAt: string | null;
  readonly memberId: string;
};

export type ParticipationLeaveRow = {
  readonly leftAt: string | null;
  readonly memberId: string;
  readonly deviceId: string;
};

export async function readMembershipForLeave(
  sql: SqlClient,
  memberId: string,
  spaceId: string
): Promise<MembershipLeaveRow | null> {
  const membershipId = spaceMembershipEntityId(memberId, spaceId);
  const rows = await sql.query<{
    readonly left_at: string | null;
    readonly member_id: string | null;
  }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at,
            ${SpaceMembershipCol.memberId} AS member_id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  const mid = row.member_id;
  if (mid === null || mid.length === 0) return null;
  return { leftAt: row.left_at, memberId: mid };
}

export async function readParticipationForLeave(
  sql: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<ParticipationLeaveRow | null> {
  const participationId = spaceParticipationEntityId(deviceId, spaceId);
  const rows = await sql.query<{
    readonly left_at: string | null;
    readonly member_id: string | null;
    readonly device_id: string | null;
  }>(
    `SELECT ${SpaceParticipationCol.leftAt} AS left_at,
            ${SpaceParticipationCol.memberId} AS member_id,
            ${SpaceParticipationCol.deviceId} AS device_id
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?
     LIMIT 1`,
    [participationId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  const mid = row.member_id;
  const did = row.device_id;
  if (mid === null || mid.length === 0 || did === null || did.length === 0) {
    return null;
  }
  return { leftAt: row.left_at, memberId: mid, deviceId: did };
}

export async function countOtherActiveParticipations(
  sql: SqlClient,
  memberId: string,
  spaceId: string,
  excludeDeviceId: string
): Promise<number> {
  const rows = await sql.query<{ readonly c: number | string }>(
    `SELECT COUNT(*) AS c
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.spaceId} = ?
       AND ${SpaceParticipationCol.memberId} = ?
       AND ${SpaceParticipationCol.deviceId} != ?
       AND ${SpaceParticipationCol.leftAt} IS NULL`,
    [spaceId, memberId, excludeDeviceId]
  );
  return Number(rows[0]?.c ?? 0);
}

/**
 * Prefer the stamped seat member when this device still holds an active
 * participation (covers identity drift). Else fall back to current auth.
 */
export async function resolveLeaveEverywhereMemberId(
  ctx: WriteContext,
  sql: SqlClient,
  spaceId: string
): Promise<string> {
  const participation = await readParticipationForLeave(
    sql,
    ctx.deviceId,
    spaceId
  );
  if (participation !== null && participation.leftAt === null) {
    return participation.memberId;
  }
  return memberIdFromContext(ctx);
}

/** True when this device holds (or held) a seat stamped with `memberId`. */
export async function deviceHeldMemberSeat(args: {
  readonly sql: SqlClient;
  readonly deviceId: string;
  readonly spaceId: string;
  readonly memberId: string;
}): Promise<boolean> {
  const row = await readParticipationForLeave(
    args.sql,
    args.deviceId,
    args.spaceId
  );
  return row !== null && row.memberId === args.memberId;
}

export async function wasMembershipInactive(
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

export async function wasParticipationInactive(
  sql: SqlClient,
  participationId: string
): Promise<boolean> {
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceParticipationCol.leftAt} AS left_at
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?
     LIMIT 1`,
    [participationId]
  );
  const prev = rows[0];
  return prev === undefined || prev.left_at !== null;
}

/**
 * Realign `host_member_id` / `host_account_id` to the current owner identity.
 * Creating device (`host_id = deviceId`) always updates both; account owners
 * on another device only realign `host_member_id`.
 */
export async function migrateHostIdentity(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly deviceId: string;
  readonly newMemberId: string;
  readonly accountId: string | null;
}): Promise<void> {
  await args.sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.hostMemberId} = ?,
         ${SpaceCol.hostAccountId} = ?
     WHERE ${SpaceCol.id} = ?
       AND ${SpaceCol.hostId} = ?`,
    [args.newMemberId, args.accountId, args.spaceId, args.deviceId]
  );
  if (args.accountId !== null && args.accountId.length > 0) {
    await args.sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.hostMemberId} = ?
       WHERE ${SpaceCol.id} = ?
         AND ${SpaceCol.hostAccountId} = ?
         AND ${SpaceCol.hostId} != ?`,
      [args.newMemberId, args.spaceId, args.accountId, args.deviceId]
    );
  }
}

export async function countActiveParticipationsInSpace(
  sql: SqlClient,
  spaceId: string
): Promise<number> {
  const rows = await sql.query<{ readonly c: number | string }>(
    `SELECT COUNT(*) AS c
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.spaceId} = ?
       AND ${SpaceParticipationCol.leftAt} IS NULL`,
    [spaceId]
  );
  return Number(rows[0]?.c ?? 0);
}

/**
 * When no seats remain, stamp `ended_at` so orphan Live cards cannot linger
 * without a miniplayer seat (host left earlier, or last guest left).
 */
export async function maybeAutoEndEmptyHostSpace(
  ctx: WriteContext,
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  const space = await readSpaceHostEnded(sql, spaceId);
  if (!space.ok || space.value.endedAt !== null) return;
  const remaining = await countActiveParticipationsInSpace(sql, spaceId);
  if (remaining > 0) return;
  const memberId = memberIdFromContext(ctx);
  const hostLeaving = isSpaceHostActor({
    hostId: space.value.hostId,
    hostMemberId: space.value.hostMemberId,
    hostAccountId: space.value.hostAccountId,
    memberId,
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  if (hostLeaving) {
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.endedAt} = ?,
           ${SpaceCol.hostId} = ?,
           ${SpaceCol.hostMemberId} = ?,
           ${SpaceCol.hostAccountId} = ?
       WHERE ${SpaceCol.id} = ?
         AND ${SpaceCol.endedAt} IS NULL`,
      [isoNow(), ctx.deviceId, memberId, ctx.accountId, spaceId]
    );
    return;
  }
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.endedAt} = ?
     WHERE ${SpaceCol.id} = ?
       AND ${SpaceCol.endedAt} IS NULL`,
    [isoNow(), spaceId]
  );
}

export function requireNonEmptyString(
  value: unknown,
  field: string
): WriteResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail('INVALID_INPUT', `${field} is required`);
  }
  return ok(value);
}

export function asObjectRecord(
  raw: unknown,
  label: string
): WriteResult<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', `${label} must be an object`);
  }
  return ok(raw as Record<string, unknown>);
}
