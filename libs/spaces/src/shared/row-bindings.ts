import {
  SPACE_USERS_TABLE,
  SPACES_TABLE,
  SpaceCol,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { readRowString } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  authorizeSpaceHost,
  readSpaceHostEnded,
  requireAccountId,
} from './space-write-helpers';

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

function spaceIdFromUsersRowId(rowId: string): WriteResult<string> {
  const sep = rowId.indexOf(':');
  if (sep <= 0) {
    return fail('SPACE_INVALID_INPUT', 'Invalid space_users row id');
  }
  return ok(rowId.slice(0, sep));
}

/**
 * Self ACL upsert for public join / host create. Create-space uploads
 * `space_users` in the same CRUD batch as `spaces`; when the parent row is
 * not on Postgres yet, allow bootstrap if `created_by_account_id` matches the
 * uploader (FK still requires the space row on apply — client reorders
 * parents first).
 */
async function authorizeSelfSpaceUserGrant(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string,
  row: RowChange
): Promise<WriteResult<void>> {
  const space = await readSpaceHostEnded(db, spaceId);
  if (!space.ok) {
    if (row.op === 'delete') return space;
    const createdBy = readRowString(row, SpaceUserCol.createdByAccountId);
    if (createdBy !== ctx.accountId) {
      return space;
    }
    return ok(undefined);
  }
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  return ok(undefined);
}

async function authorizeSpaceUsersUpload(
  ctx: WriteContext,
  row: RowChange,
  db: SqlClient
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const spaceId = readRowString(row, SpaceUserCol.spaceId);
  const userId = readRowString(row, SpaceUserCol.userId);

  if (spaceId === undefined || spaceId.length === 0) {
    const parsed = spaceIdFromUsersRowId(row.id);
    if (!parsed.ok) return parsed;
    return authorizeSpaceHost(
      ctx,
      db,
      parsed.value,
      'Only the host can manage space users'
    );
  }

  if (userId === undefined || userId.length === 0) {
    return fail('SPACE_INVALID_INPUT', 'user_id is required');
  }
  if (row.id !== spaceUserEntityId(spaceId, userId)) {
    return fail(
      'SPACE_INVALID_INPUT',
      'space_users id must match space + user'
    );
  }

  if (userId === accountId.value && row.op !== 'delete') {
    return authorizeSelfSpaceUserGrant(ctx, db, spaceId, row);
  }

  return authorizeSpaceHost(
    ctx,
    db,
    spaceId,
    'Only the host can manage space users'
  );
}

const spaceUsersRowWrite = defineRowAuthorizeWrite({
  name: 'space_users.upload',
  authorize: authorizeSpaceUsersUpload,
});

export const SPACE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [SPACES_TABLE.tableName]: createRowWriteBinding(spacesRowWrite),
  [SPACE_USERS_TABLE.tableName]: createRowWriteBinding(spaceUsersRowWrite),
};
