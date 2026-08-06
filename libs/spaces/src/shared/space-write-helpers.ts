import { spaceUserEntityId } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  decideEndSpace,
  isSpaceHostActor,
} from '@libs/spaces/shared/participation/space-participation-policy';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import {
  SPACE_HOST_REQUIRED,
  SPACE_NOT_FOUND,
  SPACE_NOT_SIGNED_IN,
} from '@libs/spaces/shared/rules/codes';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export function isoNow(): string {
  return new Date().toISOString();
}

export function requireAccountId(auth: AppRulesAuth): string {
  if (
    auth.accountId === null ||
    auth.accountId.length === 0 ||
    auth.isAnon
  ) {
    throwRulesReject([fail(SPACE_NOT_SIGNED_IN)]);
  }
  return auth.accountId;
}

export function memberIdFromAuth(auth: AppRulesAuth): string {
  return resolveSpaceMemberId(requireAccountId(auth));
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
): Promise<SpaceHostEnded> {
  const rows = await db.query(sql<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly ended_at: string | null;
  }>`
    SELECT host_id, host_member_id, host_account_id, ended_at
    FROM spaces
    WHERE id = ${spaceId}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) {
    throwRulesReject([fail(SPACE_NOT_FOUND)]);
  }
  const hostId = row.host_id;
  if (hostId === null || hostId.length === 0) {
    throwRulesReject([fail(SPACE_NOT_FOUND)]);
  }
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? hostId;
  if (hostMemberId.length === 0) {
    throwRulesReject([fail(SPACE_NOT_FOUND)]);
  }
  return {
    hostId,
    hostMemberId,
    hostAccountId: row.host_account_id,
    endedAt: row.ended_at,
  };
}

export async function authorizeSpaceHost(
  auth: AppRulesAuth,
  db: SqlClient,
  spaceId: string,
  deniedMessage: string
): Promise<void> {
  const space = await readSpaceHostEnded(db, spaceId);
  const memberId = memberIdFromAuth(auth);
  const decision = decideEndSpace({
    isHostActor: isSpaceHostActor({
      hostId: space.hostId,
      hostMemberId: space.hostMemberId,
      hostAccountId: space.hostAccountId,
      memberId,
      accountId: auth.accountId,
      deviceId: auth.deviceId,
    }),
  });
  if (!decision.allowed) {
    throwRulesReject([
      fail(SPACE_HOST_REQUIRED, { params: { message: deniedMessage } }),
    ]);
  }
}

export async function isSpaceUserInStore(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<boolean> {
  if (spaceId.length === 0 || userId.length === 0) return false;
  const id = spaceUserEntityId(spaceId, userId);
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id
    FROM space_users
    WHERE id = ${id}
    LIMIT 1
  `);
  return rows[0] !== undefined;
}

export async function upsertSpaceUserRow(args: {
  readonly db: SqlClient;
  readonly spaceId: string;
  readonly userId: string;
  readonly createdByAccountId: string;
  readonly now?: string;
}): Promise<void> {
  const already = await isSpaceUserInStore(args.db, args.spaceId, args.userId);
  if (already) return;
  const now = args.now ?? isoNow();
  await args.db.run(sql<void>`
    INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
    VALUES (
      ${spaceUserEntityId(args.spaceId, args.userId)},
      ${args.spaceId},
      ${args.userId},
      ${now},
      ${args.createdByAccountId}
    )
  `);
}

export async function migrateHostIdentity(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly deviceId: string;
  readonly newMemberId: string;
  readonly accountId: string;
}): Promise<void> {
  await args.sql.run(sql<void>`
    UPDATE spaces
    SET host_member_id = ${args.newMemberId}, host_account_id = ${args.accountId}
    WHERE id = ${args.spaceId} AND host_id = ${args.deviceId}
  `);
  await args.sql.run(sql<void>`
    UPDATE spaces
    SET host_member_id = ${args.newMemberId}
    WHERE id = ${args.spaceId}
      AND host_account_id = ${args.accountId}
      AND host_id != ${args.deviceId}
  `);
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: `${field} is required` } }),
    ]);
  }
  return value;
}

export function asObjectRecord(
  raw: unknown,
  label: string
): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object') {
    throwRulesReject([
      fail('INVALID_INPUT', {
        params: { message: `${label} must be an object` },
      }),
    ]);
  }
  return raw as Record<string, unknown>;
}
