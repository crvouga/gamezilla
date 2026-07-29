import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';

import {
  asObjectRecord,
  isSpaceUserInStore,
  migrateHostIdentity,
  requireAccountId,
  requireNonEmptyString,
  upsertSpaceUserRow,
} from '../space-write-helpers';
import {
  authorizeJoinSpaceAccess,
  readSpaceRowForJoin,
} from './join-space-access';

export type JoinSpaceInput = {
  readonly spaceId: string;
};

function parseJoinSpaceInput(raw: unknown): WriteResult<JoinSpaceInput> {
  const record = asObjectRecord(raw, 'join space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

export async function authorizeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  return authorizeJoinSpaceAccess(ctx, db, input.spaceId);
}

/**
 * Open/join a space: ensure ACL (`space_users`) exists for the actor.
 * Live seat + "opened" are room / local state — not written here.
 * Public join self-upserts ACL so the space can sync.
 */
export async function executeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const already = await isSpaceUserInStore(db, input.spaceId, memberId);
  if (!already) {
    await upsertSpaceUserRow({
      db,
      spaceId: input.spaceId,
      userId: memberId,
      createdByAccountId: accountId.value,
    });
  }
  const space = await readSpaceRowForJoin(db, input.spaceId);
  if (
    space.ok &&
    isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId,
      accountId: accountId.value,
      deviceId: ctx.deviceId,
    })
  ) {
    await migrateHostIdentity({
      sql: db,
      spaceId: input.spaceId,
      deviceId: ctx.deviceId,
      newMemberId: memberId,
      accountId: accountId.value,
    });
  }
  return ok(undefined);
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: parseJoinSpaceInput,
  authorize: authorizeJoinSpace,
  execute: executeJoinSpace,
});
