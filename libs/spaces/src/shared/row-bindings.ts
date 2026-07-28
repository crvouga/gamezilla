import {
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { readOne, readRowString } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { authorizeLeaveSpace } from './leave-space/leave-space-write';
import { readSpaceHostEnded, requireAccountId } from './space-write-helpers';

/**
 * Create-space uploads as PUT before the row exists on Postgres. Authorize from
 * claimed host fields (must match the uploader), not a DB lookup.
 */
function authorizeSpaceCreateFromRow(
  ctx: WriteContext,
  row: RowChange
): WriteResult<void> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const hostId = readRowString(row, SpaceCol.hostId);
  if (hostId !== ctx.deviceId) {
    return fail(
      'SPACE_WRITE_DENIED',
      'Only the host device can create a space'
    );
  }
  const memberId = resolveSpaceMemberId(accountId.value);
  const hostMemberId =
    readRowString(row, SpaceCol.hostMemberId) ??
    readRowString(row, SpaceCol.hostAccountId);
  if (hostMemberId !== memberId) {
    return fail(
      'SPACE_WRITE_DENIED',
      'Only the host member can create a space'
    );
  }
  const hostAccountId = readRowString(row, SpaceCol.hostAccountId);
  if (hostAccountId !== undefined && hostAccountId !== accountId.value) {
    return fail(
      'SPACE_WRITE_DENIED',
      'host_account_id must match the uploader'
    );
  }
  return ok(undefined);
}

async function authorizeSpacesUpload(
  ctx: WriteContext,
  row: RowChange,
  db: SqlClient
): Promise<WriteResult<void>> {
  if (row.op === 'delete') {
    return fail('SPACE_DELETE_DENIED', 'spaces cannot be deleted via sync');
  }
  const space = await readSpaceHostEnded(db, row.id);
  if (!space.ok) {
    if (row.op === 'put') {
      return authorizeSpaceCreateFromRow(ctx, row);
    }
    return space;
  }
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const isHost = isSpaceHostActor({
    hostId: space.value.hostId,
    hostMemberId: space.value.hostMemberId,
    hostAccountId: space.value.hostAccountId,
    memberId,
    accountId: accountId.value,
    deviceId: ctx.deviceId,
  });
  if (!isHost) {
    return fail('SPACE_WRITE_DENIED', 'Only the host can patch this space');
  }
  return ok(undefined);
}

const spacesRowWrite = defineRowAuthorizeWrite({
  name: 'spaces.upload',
  authorize: authorizeSpacesUpload,
});

async function resolveMembershipSpaceId(
  row: RowChange,
  db: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceMembershipCol.spaceId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly space_id: string }>(
    db,
    honey({
      select: [SpaceMembershipCol.spaceId],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, row.id],
      limit: 1,
    }),
    'SPACE_MEMBERSHIP_NOT_FOUND'
  );
  if (!result.ok) return result;
  return ok(result.value.space_id);
}

async function resolveMembershipMemberId(
  row: RowChange,
  db: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceMembershipCol.memberId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly member_id: string }>(
    db,
    honey({
      select: [SpaceMembershipCol.memberId],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, row.id],
      limit: 1,
    }),
    'SPACE_MEMBERSHIP_NOT_FOUND'
  );
  if (!result.ok) return result;
  return ok(result.value.member_id);
}

function isLeaveShape(row: RowChange, leftAtCol: string): boolean {
  const leftAt = row.values?.[leftAtCol];
  return typeof leftAt === 'string' && leftAt.length > 0;
}

async function authorizeSpaceMembershipUpload(
  ctx: WriteContext,
  row: RowChange,
  db: SqlClient
): Promise<WriteResult<void>> {
  if (row.op === 'delete') {
    return fail(
      'SPACE_MEMBERSHIP_DELETE_DENIED',
      'space memberships cannot be deleted via sync'
    );
  }
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const spaceIdResult = await resolveMembershipSpaceId(row, db);
  if (!spaceIdResult.ok) return spaceIdResult;
  const memberIdResult = await resolveMembershipMemberId(row, db);
  if (!memberIdResult.ok) return memberIdResult;
  const seatMemberId = memberIdResult.value;
  const currentMemberId = resolveSpaceMemberId(accountId.value);
  if (seatMemberId !== currentMemberId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this member can upload its membership'
    );
  }
  const expectedId = spaceMembershipEntityId(seatMemberId, spaceIdResult.value);
  if (row.id !== expectedId) {
    return fail(
      'SPACE_MEMBERSHIP_ID_MISMATCH',
      'Membership id must match space + member'
    );
  }
  if (isLeaveShape(row, SpaceMembershipCol.leftAt)) {
    return authorizeLeaveSpace(ctx, { spaceId: spaceIdResult.value }, db);
  }
  const space = await readSpaceHostEnded(db, spaceIdResult.value);
  if (!space.ok) return space;
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  return ok(undefined);
}

const spaceMembershipsRowWrite = defineRowAuthorizeWrite({
  name: 'space_memberships.upload',
  authorize: authorizeSpaceMembershipUpload,
});

export const SPACE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [SPACES_TABLE.tableName]: createRowWriteBinding(spacesRowWrite),
  [SPACE_MEMBERSHIPS_TABLE.tableName]: createRowWriteBinding(
    spaceMembershipsRowWrite
  ),
};
