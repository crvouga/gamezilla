import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  decideEndSpace,
  isSpaceHostActor,
} from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { readOne } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export function isoNow(): string {
  return new Date().toISOString();
}

export function requireAccountId(ctx: WriteContext): WriteResult<string> {
  if (ctx.accountId === null || ctx.accountId.length === 0) {
    return fail('SPACE_NOT_SIGNED_IN', 'Sign in to continue');
  }
  return ok(ctx.accountId);
}

export function memberIdFromContext(ctx: WriteContext): WriteResult<string> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  return ok(resolveSpaceMemberId(accountId.value));
}

export type SpaceHostEnded = {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly hostAccountId: string | null;
  readonly endedAt: string | null;
};

export async function readSpaceHostEnded(
  db: SqlClient,
  spaceId: string
): Promise<WriteResult<SpaceHostEnded>> {
  const result = await readOne<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly ended_at: string | null;
  }>(
    db,
    sql`SELECT ${raw(SpaceCol.hostId)}, ${raw(SpaceCol.hostMemberId)},
            ${raw(SpaceCol.hostAccountId)}, ${raw(SpaceCol.endedAt)}
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.id)} = ${spaceId} LIMIT 1`,
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
  db: SqlClient,
  spaceId: string,
  deniedMessage: string
): Promise<WriteResult<void>> {
  const space = await readSpaceHostEnded(db, spaceId);
  if (!space.ok) return space;
  const memberId = memberIdFromContext(ctx);
  if (!memberId.ok) return memberId;
  const decision = decideEndSpace({
    isHostActor: isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId: memberId.value,
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    }),
  });
  if (!decision.allowed) {
    return fail('SPACE_HOST_REQUIRED', deniedMessage);
  }
  return ok(undefined);
}

export type MembershipLeaveRow = {
  readonly leftAt: string | null;
  readonly memberId: string;
};

export async function readMembershipForLeave(
  db: SqlClient,
  memberId: string,
  spaceId: string
): Promise<MembershipLeaveRow | null> {
  const membershipId = spaceMembershipEntityId(memberId, spaceId);
  const rows = await db.query<{
    readonly left_at: string | null;
    readonly member_id: string | null;
  }>(sql`SELECT ${raw(SpaceMembershipCol.leftAt)} AS left_at,
            ${raw(SpaceMembershipCol.memberId)} AS member_id
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.id)} = ${membershipId}
     LIMIT 1`);
  const row = rows[0];
  if (row === undefined) return null;
  const mid = row.member_id;
  if (mid === null || mid.length === 0) return null;
  return { leftAt: row.left_at, memberId: mid };
}

export async function wasMembershipInactive(
  db: SqlClient,
  membershipId: string
): Promise<boolean> {
  const rows = await db.query<{ readonly left_at: string | null }>(
    sql`SELECT ${raw(SpaceMembershipCol.leftAt)} AS left_at
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.id)} = ${membershipId}
     LIMIT 1`
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
  readonly accountId: string;
}): Promise<void> {
  await args.sql.run(sql`UPDATE ${raw(SPACES_TABLE.tableName)}
     SET ${raw(SpaceCol.hostMemberId)} = ${args.newMemberId},
         ${raw(SpaceCol.hostAccountId)} = ${args.accountId}
     WHERE ${raw(SpaceCol.id)} = ${args.spaceId}
       AND ${raw(SpaceCol.hostId)} = ${args.deviceId}`);
  await args.sql.run(sql`UPDATE ${raw(SPACES_TABLE.tableName)}
     SET ${raw(SpaceCol.hostMemberId)} = ${args.newMemberId}
     WHERE ${raw(SpaceCol.id)} = ${args.spaceId}
       AND ${raw(SpaceCol.hostAccountId)} = ${args.accountId}
       AND ${raw(SpaceCol.hostId)} != ${args.deviceId}`);
}

export async function countActiveMembershipsInSpace(
  db: SqlClient,
  spaceId: string
): Promise<number> {
  const rows = await db.query<{ readonly c: number | string }>(
    sql`SELECT COUNT(*) AS c
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.spaceId)} = ${spaceId}
       AND ${raw(SpaceMembershipCol.leftAt)} IS NULL`
  );
  return Number(rows[0]?.c ?? 0);
}

/**
 * When no memberships remain, stamp `ended_at` so orphan Live cards cannot linger
 * without a miniplayer seat (host left earlier, or last guest left).
 */
export async function maybeAutoEndEmptyHostSpace(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string
): Promise<void> {
  const space = await readSpaceHostEnded(db, spaceId);
  if (!space.ok || space.value.endedAt !== null) return;
  const remaining = await countActiveMembershipsInSpace(db, spaceId);
  if (remaining > 0) return;
  const memberIdResult = memberIdFromContext(ctx);
  const memberId = memberIdResult.ok ? memberIdResult.value : ctx.deviceId;
  const hostLeaving = isSpaceHostActor({
    hostId: space.value.hostId,
    hostMemberId: space.value.hostMemberId,
    hostAccountId: space.value.hostAccountId,
    memberId,
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  if (hostLeaving) {
    await db.run(sql`UPDATE ${raw(SPACES_TABLE.tableName)}
       SET ${raw(SpaceCol.endedAt)} = ${isoNow()},
           ${raw(SpaceCol.hostId)} = ${ctx.deviceId},
           ${raw(SpaceCol.hostMemberId)} = ${memberId},
           ${raw(SpaceCol.hostAccountId)} = ${ctx.accountId}
       WHERE ${raw(SpaceCol.id)} = ${spaceId}
         AND ${raw(SpaceCol.endedAt)} IS NULL`);
    return;
  }
  await db.run(sql`UPDATE ${raw(SPACES_TABLE.tableName)}
     SET ${raw(SpaceCol.endedAt)} = ${isoNow()}
     WHERE ${raw(SpaceCol.id)} = ${spaceId}
       AND ${raw(SpaceCol.endedAt)} IS NULL`);
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
