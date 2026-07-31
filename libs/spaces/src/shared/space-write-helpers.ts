import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SPACES_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  decideEndSpace,
  isSpaceHostActor,
} from '@libs/spaces/shared/participation/space-participation-policy';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { readOne } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';

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
    sqlMap({
      select: [
        SpaceCol.hostId,
        SpaceCol.hostMemberId,
        SpaceCol.hostAccountId,
        SpaceCol.endedAt,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, spaceId],
      limit: 1,
    }),
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

export async function isSpaceUserInStore(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<boolean> {
  if (spaceId.length === 0 || userId.length === 0) return false;
  const id = spaceUserEntityId(spaceId, userId);
  const rows = await db.query<{ readonly id: string }>(
    sqlMap({
      select: [SpaceUserCol.id],
      from: SPACE_USERS_TABLE.tableName,
      where: ['=', SpaceUserCol.id, id],
      limit: 1,
    })
  );
  return rows[0] !== undefined;
}

export async function upsertSpaceUserRow(args: {
  readonly db: SqlClient;
  readonly spaceId: string;
  readonly userId: string;
  readonly createdByAccountId: string;
  readonly now?: string;
}): Promise<void> {
  // PowerSync synced names are SQLite views — INSERT … ON CONFLICT fails with
  // "cannot UPSERT a view". Select-then-plain-INSERT is the client pattern.
  const already = await isSpaceUserInStore(args.db, args.spaceId, args.userId);
  if (already) return;
  await args.db.run(
    sqlMap({
      insertInto: SPACE_USERS_TABLE.tableName,
      values: {
        [SpaceUserCol.id]: spaceUserEntityId(args.spaceId, args.userId),
        [SpaceUserCol.spaceId]: args.spaceId,
        [SpaceUserCol.userId]: args.userId,
        [SpaceUserCol.createdAt]: args.now ?? isoNow(),
        [SpaceUserCol.createdByAccountId]: args.createdByAccountId,
      },
    })
  );
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
  await args.sql.run(
    sqlMap({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.hostMemberId]: args.newMemberId,
        [SpaceCol.hostAccountId]: args.accountId,
      },
      where: [
        'and',
        ['=', SpaceCol.id, args.spaceId],
        ['=', SpaceCol.hostId, args.deviceId],
      ],
    })
  );
  await args.sql.run(
    sqlMap({
      update: SPACES_TABLE.tableName,
      set: { [SpaceCol.hostMemberId]: args.newMemberId },
      where: [
        'and',
        ['=', SpaceCol.id, args.spaceId],
        ['=', SpaceCol.hostAccountId, args.accountId],
        ['!=', SpaceCol.hostId, args.deviceId],
      ],
    })
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
