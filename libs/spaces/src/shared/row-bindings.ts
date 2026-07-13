import {
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import {
  ownerMatches,
  readOne,
  readRowString,
} from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { authorizeLeaveSpace } from './leave-space/leave-space-write';
import { readSpaceHostEnded } from './space-write-helpers';

const spacesRowWrite = defineRowAuthorizeWrite({
  name: 'spaces.patch',
  authorize: async (ctx, row) => {
    const hostId = readRowString(row, SpaceCol.hostId);
    return (
      ownerMatches(hostId, ctx.deviceId, 'SPACE_WRITE_DENIED') ?? ok(undefined)
    );
  },
});

async function resolveMembershipSpaceId(
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceMembershipCol.spaceId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly space_id: string }>(
    sql,
    `SELECT ${SpaceMembershipCol.spaceId} AS space_id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [row.id],
    'SPACE_MEMBERSHIP_NOT_FOUND'
  );
  if (!result.ok) return result;
  return ok(result.value.space_id);
}

async function resolveMembershipGuestId(
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceMembershipCol.guestId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly guest_id: string }>(
    sql,
    `SELECT ${SpaceMembershipCol.guestId} AS guest_id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [row.id],
    'SPACE_MEMBERSHIP_NOT_FOUND'
  );
  if (!result.ok) return result;
  return ok(result.value.guest_id);
}

function isLeaveMembershipShape(row: RowChange): boolean {
  const leftAt = row.values?.[SpaceMembershipCol.leftAt];
  return typeof leftAt === 'string' && leftAt.length > 0;
}

/**
 * Upload auth for memberships: guest must own the deterministic id.
 * Leave-shaped patches reuse leave authorize; join-shaped puts require a live
 * non-host space. Full visibility / invite ABAC lives on {@link joinSpaceWrite}
 * (REST remains for invite/private when local invite rows are missing).
 */
async function authorizeSpaceMembershipUpload(
  ctx: WriteContext,
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<void>> {
  if (row.op === 'delete') {
    return fail(
      'SPACE_MEMBERSHIP_DELETE_DENIED',
      'space memberships cannot be deleted via sync'
    );
  }
  const spaceIdResult = await resolveMembershipSpaceId(row, sql);
  if (!spaceIdResult.ok) return spaceIdResult;
  const guestIdResult = await resolveMembershipGuestId(row, sql);
  if (!guestIdResult.ok) return guestIdResult;
  if (guestIdResult.value !== ctx.deviceId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this device can upload its membership'
    );
  }
  const expectedId = spaceDeviceMembershipEntityId(
    ctx.deviceId,
    spaceIdResult.value
  );
  if (row.id !== expectedId) {
    return fail(
      'SPACE_MEMBERSHIP_ID_MISMATCH',
      'Membership id must match space + device'
    );
  }
  if (isLeaveMembershipShape(row)) {
    return authorizeLeaveSpace(ctx, { spaceId: spaceIdResult.value }, sql);
  }
  // Join / create seat: guest owns deterministic id; space must be live.
  // Host seats from create_space are allowed; join ABAC is on joinSpaceWrite.
  const space = await readSpaceHostEnded(sql, spaceIdResult.value);
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
