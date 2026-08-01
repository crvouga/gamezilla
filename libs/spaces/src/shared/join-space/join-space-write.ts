import { SPACE_USERS_TABLE, spaceUserEntityId } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import type { RulesAuth } from '@pkgs/rules/core/types';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

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

export function parseJoinSpaceInput(raw: unknown): JoinSpaceInput {
  const record = asObjectRecord(raw, 'join space input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  return { spaceId };
}

export async function authorizeJoinSpace(
  auth: RulesAuth,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<void> {
  await authorizeJoinSpaceAccess(auth, db, input.spaceId);
}

export function joinSpaceBeforeBatch(
  auth: RulesAuth,
  input: JoinSpaceInput
): UploadBatch {
  const accountId = requireAccountId(auth);
  const memberId = resolveSpaceMemberId(accountId);
  return {
    rows: [
      {
        op: 'put',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(input.spaceId, memberId),
        values: {
          id: spaceUserEntityId(input.spaceId, memberId),
          space_id: input.spaceId,
          user_id: memberId,
          created_by_account_id: accountId,
        },
      },
    ],
  };
}

/**
 * Open/join a space: ensure ACL (`space_users`) exists for the actor.
 */
export async function executeJoinSpace(
  auth: RulesAuth,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  const memberId = resolveSpaceMemberId(accountId);
  const already = await isSpaceUserInStore(db, input.spaceId, memberId);
  if (!already) {
    await upsertSpaceUserRow({
      db,
      spaceId: input.spaceId,
      userId: memberId,
      createdByAccountId: accountId,
    });
  }
  const space = await readSpaceRowForJoin(db, input.spaceId);
  if (
    isSpaceHostActor({
      hostId: space.hostId,
      hostMemberId: space.hostMemberId,
      hostAccountId: space.hostAccountId,
      memberId,
      accountId,
      deviceId: auth.deviceId,
    })
  ) {
    await migrateHostIdentity({
      sql: db,
      spaceId: input.spaceId,
      deviceId: auth.deviceId,
      newMemberId: memberId,
      accountId,
    });
  }
}
