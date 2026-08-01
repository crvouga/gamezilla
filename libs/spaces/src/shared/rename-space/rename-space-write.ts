import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type RenameSpaceInput = {
  readonly spaceId: string;
  readonly title: string;
};

export function parseRenameSpaceInput(raw: unknown): RenameSpaceInput {
  const record = asObjectRecord(raw, 'rename space input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const title = record['title'];
  if (typeof title !== 'string') {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: 'title is required' } }),
    ]);
  }
  return { spaceId, title };
}

export async function authorizeRenameSpace(
  auth: AppRulesAuth,
  input: RenameSpaceInput,
  db: SqlClient
): Promise<void> {
  await authorizeSpaceHost(
    auth,
    db,
    input.spaceId,
    'Only the host can rename this space'
  );
}

export function renameSpaceBeforeBatch(input: RenameSpaceInput): UploadBatch {
  return {
    rows: [
      {
        op: 'patch',
        table: SPACES_TABLE.tableName,
        id: input.spaceId,
        values: { title: input.title },
      },
    ],
  };
}

export async function renameSpace(
  auth: AppRulesAuth,
  input: RenameSpaceInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  const trimmed = input.title.trim();
  const memberId = resolveSpaceMemberId(accountId);
  await db.run(
    sqlMap({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.title]: trimmed.length > 0 ? trimmed : null,
        [SpaceCol.hostId]: auth.deviceId,
        [SpaceCol.hostMemberId]: memberId,
      },
      where: ['=', SpaceCol.id, input.spaceId],
    })
  );
}
