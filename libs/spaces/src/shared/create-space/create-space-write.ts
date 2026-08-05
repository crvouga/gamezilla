import {
  SPACE_USERS_TABLE,
  SPACES_TABLE,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import { openSpaceSession } from '../open-space/space-open-session-write';
import {
  asObjectRecord,
  isoNow,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type CreateSpaceInput = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
};

export function parseCreateSpaceInput(raw: unknown): CreateSpaceInput {
  const record = asObjectRecord(raw, 'create space input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const visibilityRaw = record['visibility'];
  if (!isSpaceVisibility(visibilityRaw)) {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: 'visibility is required' } }),
    ]);
  }
  return { spaceId, visibility: visibilityRaw };
}

export function createSpaceBeforeBatch(
  auth: AppRulesAuth,
  input: CreateSpaceInput
): UploadBatch {
  const accountId = requireAccountId(auth);
  const memberId = resolveSpaceMemberId(accountId);
  const now = isoNow();
  return {
    rows: [
      {
        op: 'put',
        table: SPACES_TABLE.tableName,
        id: input.spaceId,
        values: {
          id: input.spaceId,
          host_id: auth.deviceId,
          created_at: now,
          visibility: input.visibility,
          host_account_id: accountId,
          host_member_id: memberId,
        },
      },
      {
        op: 'put',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(input.spaceId, memberId),
        values: {
          id: spaceUserEntityId(input.spaceId, memberId),
          space_id: input.spaceId,
          user_id: memberId,
          created_at: now,
          created_by_account_id: accountId,
        },
      },
    ],
  };
}

export async function createSpace(
  auth: AppRulesAuth,
  input: CreateSpaceInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  const now = isoNow();
  const memberId = resolveSpaceMemberId(accountId);
  await db.run(sql<void>`
    INSERT INTO spaces (id, host_id, host_member_id, host_account_id, visibility, created_at)
    VALUES (
      ${input.spaceId},
      ${auth.deviceId},
      ${memberId},
      ${accountId},
      ${input.visibility},
      ${now}
    )
  `);
  await db.run(sql<void>`
    INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
    VALUES (
      ${spaceUserEntityId(input.spaceId, memberId)},
      ${input.spaceId},
      ${memberId},
      ${now},
      ${accountId}
    )
  `);
  await openSpaceSession(db, input.spaceId);
}
