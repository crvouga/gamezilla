import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SPACES_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import {
  SPACE_DELETE_DENIED,
  SPACE_ENDED,
  SPACE_INVALID_INPUT,
  SPACE_NOT_FOUND,
  SPACE_NOT_SIGNED_IN,
  SPACE_WRITE_DENIED,
} from '@libs/spaces/shared/rules/codes';
import { sqlMap } from '@pkgs/sql-map';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TablePolicy } from '@pkgs/sync-engine/server/apply-batch';
import type { UploadAuth } from '@pkgs/sync-engine/shared/rules-auth';
import type {
  UploadOp,
  UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';

import {
  columnSet,
  deny,
  ok,
  readRowString,
  type AuthzResult,
} from './table-policy-helpers';

const PUT_PATCH_DELETE = new Set<UploadOp>(['put', 'patch', 'delete']);

type SpaceHostRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

async function querySpace(
  db: SqlClient,
  spaceId: string
): Promise<SpaceHostRow | null> {
  const rows = await db.query<SpaceHostRow>(
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
    })
  );
  return rows[0] ?? null;
}

function requireAccountId(auth: UploadAuth): AuthzResult | string {
  if (auth.accountId === null || auth.accountId.length === 0) {
    return deny(SPACE_NOT_SIGNED_IN);
  }
  return auth.accountId;
}

function authorizeSpaceCreateFromRow(
  auth: UploadAuth,
  row: UploadRow
): AuthzResult {
  const accountId = requireAccountId(auth);
  if (typeof accountId !== 'string') return accountId;
  const hostId = readRowString(row, SpaceCol.hostId);
  if (hostId !== auth.deviceId) return deny(SPACE_WRITE_DENIED);
  const memberId = resolveSpaceMemberId(accountId);
  const hostMemberId =
    readRowString(row, SpaceCol.hostMemberId) ??
    readRowString(row, SpaceCol.hostAccountId);
  if (hostMemberId !== memberId) return deny(SPACE_WRITE_DENIED);
  const hostAccountId = readRowString(row, SpaceCol.hostAccountId);
  if (hostAccountId !== undefined && hostAccountId !== accountId) {
    return deny(SPACE_WRITE_DENIED);
  }
  return ok();
}

function isHostOfSpace(auth: UploadAuth, space: SpaceHostRow): boolean {
  const accountId = auth.accountId;
  if (accountId === null || accountId.length === 0) return false;
  const hostId = space.host_id ?? '';
  const hostMemberId =
    space.host_member_id ?? space.host_account_id ?? hostId;
  return isSpaceHostActor({
    hostId,
    hostMemberId,
    hostAccountId: space.host_account_id,
    memberId: resolveSpaceMemberId(accountId),
    accountId,
    deviceId: auth.deviceId,
  });
}

async function authorizeSpacesUpload(
  auth: UploadAuth,
  row: UploadRow,
  db: SqlClient
): Promise<AuthzResult> {
  if (row.op === 'delete') return deny(SPACE_DELETE_DENIED);
  const space = await querySpace(db, row.id);
  if (space === null) {
    if (row.op === 'put') return authorizeSpaceCreateFromRow(auth, row);
    return deny(SPACE_NOT_FOUND);
  }
  const accountId = requireAccountId(auth);
  if (typeof accountId !== 'string') return accountId;
  if (!isHostOfSpace(auth, space)) return deny(SPACE_WRITE_DENIED);
  return ok();
}

function spaceIdFromUsersRowId(rowId: string): string | null {
  const sep = rowId.indexOf(':');
  if (sep <= 0) return null;
  return rowId.slice(0, sep);
}

async function authorizeSelfSpaceUserGrant(
  auth: UploadAuth,
  db: SqlClient,
  spaceId: string,
  row: UploadRow
): Promise<AuthzResult> {
  const space = await querySpace(db, spaceId);
  if (space === null) {
    if (row.op === 'delete') return deny(SPACE_NOT_FOUND);
    const createdBy = readRowString(row, SpaceUserCol.createdByAccountId);
    if (createdBy !== auth.accountId) return deny(SPACE_NOT_FOUND);
    return ok();
  }
  if (space.ended_at !== null) return deny(SPACE_ENDED);
  return ok();
}

function isSelfSpaceUser(auth: UploadAuth, userId: string): boolean {
  const accountId = auth.accountId;
  if (accountId === null) return false;
  const memberId = resolveSpaceMemberId(accountId);
  return userId === memberId || userId === accountId;
}

async function authorizeSpaceHostRow(
  auth: UploadAuth,
  db: SqlClient,
  spaceId: string
): Promise<AuthzResult> {
  const space = await querySpace(db, spaceId);
  if (space === null) return deny(SPACE_NOT_FOUND);
  if (!isHostOfSpace(auth, space)) return deny(SPACE_WRITE_DENIED);
  return ok();
}

function validateSpaceUserIds(
  row: UploadRow,
  spaceId: string,
  userId: string | undefined
): AuthzResult | null {
  if (userId === undefined || userId.length === 0) {
    return deny(SPACE_INVALID_INPUT);
  }
  if (row.id !== spaceUserEntityId(spaceId, userId)) {
    return deny(SPACE_INVALID_INPUT);
  }
  return null;
}

async function authorizeSpaceUsersUpload(
  auth: UploadAuth,
  row: UploadRow,
  db: SqlClient
): Promise<AuthzResult> {
  const accountId = requireAccountId(auth);
  if (typeof accountId !== 'string') return accountId;

  const spaceId = readRowString(row, SpaceUserCol.spaceId);
  const userId = readRowString(row, SpaceUserCol.userId);

  if (spaceId === undefined || spaceId.length === 0) {
    const parsed = spaceIdFromUsersRowId(row.id);
    if (parsed === null) return deny(SPACE_INVALID_INPUT);
    return authorizeSpaceHostRow(auth, db, parsed);
  }

  const invalid = validateSpaceUserIds(row, spaceId, userId);
  if (invalid !== null) return invalid;

  if (isSelfSpaceUser(auth, userId!)) {
    return authorizeSelfSpaceUserGrant(auth, db, spaceId, row);
  }
  return authorizeSpaceHostRow(auth, db, spaceId);
}

export function spacesTablePolicies(): readonly TablePolicy[] {
  return [
    {
      table: SPACES_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(SpaceCol),
      authorize: authorizeSpacesUpload,
    },
    {
      table: SPACE_USERS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(SpaceUserCol),
      authorize: authorizeSpaceUsersUpload,
    },
  ];
}
