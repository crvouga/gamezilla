import {
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceMembershipCol,
  SpaceParticipationCol,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { isHostMember } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
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
import { authorizeLeaveSpaceEverywhere } from './leave-space/leave-space-everywhere-write';
import { readSpaceHostEnded } from './space-write-helpers';

const spacesRowWrite = defineRowAuthorizeWrite({
  name: 'spaces.patch',
  authorize: async (ctx, row, sql) => {
    const space = await readSpaceHostEnded(sql, row.id);
    if (!space.ok) return space;
    const memberId = resolveSpaceMemberId({
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    });
    if (
      !isHostMember({
        hostMemberId: space.value.hostMemberId,
        memberId,
      })
    ) {
      return fail('SPACE_WRITE_DENIED', 'Only the host can patch this space');
    }
    return ok(undefined);
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

async function resolveMembershipMemberId(
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceMembershipCol.memberId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly member_id: string }>(
    sql,
    `SELECT ${SpaceMembershipCol.memberId} AS member_id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [row.id],
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
  const memberIdResult = await resolveMembershipMemberId(row, sql);
  if (!memberIdResult.ok) return memberIdResult;
  const memberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  if (memberIdResult.value !== memberId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this member can upload its membership'
    );
  }
  const expectedId = spaceMembershipEntityId(memberId, spaceIdResult.value);
  if (row.id !== expectedId) {
    return fail(
      'SPACE_MEMBERSHIP_ID_MISMATCH',
      'Membership id must match space + member'
    );
  }
  if (isLeaveShape(row, SpaceMembershipCol.leftAt)) {
    return authorizeLeaveSpaceEverywhere(
      ctx,
      { spaceId: spaceIdResult.value },
      sql
    );
  }
  const space = await readSpaceHostEnded(sql, spaceIdResult.value);
  if (!space.ok) return space;
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  return ok(undefined);
}

async function resolveParticipationSpaceId(
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<string>> {
  const fromValues = readRowString(row, SpaceParticipationCol.spaceId);
  if (fromValues !== undefined && fromValues.length > 0) {
    return ok(fromValues);
  }
  const result = await readOne<{ readonly space_id: string }>(
    sql,
    `SELECT ${SpaceParticipationCol.spaceId} AS space_id
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?
     LIMIT 1`,
    [row.id],
    'SPACE_MEMBERSHIP_NOT_FOUND'
  );
  if (!result.ok) return result;
  return ok(result.value.space_id);
}

async function authorizeSpaceParticipationUpload(
  ctx: WriteContext,
  row: RowChange,
  sql: SqlClient
): Promise<WriteResult<void>> {
  if (row.op === 'delete') {
    return fail(
      'SPACE_MEMBERSHIP_DELETE_DENIED',
      'space participations cannot be deleted via sync'
    );
  }
  const spaceIdResult = await resolveParticipationSpaceId(row, sql);
  if (!spaceIdResult.ok) return spaceIdResult;
  const deviceFromRow = readRowString(row, SpaceParticipationCol.deviceId);
  const deviceId = deviceFromRow ?? ctx.deviceId;
  if (deviceId !== ctx.deviceId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this device can upload its participation'
    );
  }
  const expectedId = spaceParticipationEntityId(
    ctx.deviceId,
    spaceIdResult.value
  );
  if (row.id !== expectedId) {
    return fail(
      'SPACE_MEMBERSHIP_ID_MISMATCH',
      'Participation id must match space + device'
    );
  }
  if (isLeaveShape(row, SpaceParticipationCol.leftAt)) {
    return authorizeLeaveSpace(ctx, { spaceId: spaceIdResult.value }, sql);
  }
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

const spaceParticipationsRowWrite = defineRowAuthorizeWrite({
  name: 'space_participations.upload',
  authorize: authorizeSpaceParticipationUpload,
});

export const SPACE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [SPACES_TABLE.tableName]: createRowWriteBinding(spacesRowWrite),
  [SPACE_MEMBERSHIPS_TABLE.tableName]: createRowWriteBinding(
    spaceMembershipsRowWrite
  ),
  [SPACE_PARTICIPATIONS_TABLE.tableName]: createRowWriteBinding(
    spaceParticipationsRowWrite
  ),
};
