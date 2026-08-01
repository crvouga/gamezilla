import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import { SIGN_IN_REQUIRED } from '@pkgs/rules/spaces/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type SetSpaceVisibilityInput = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
};

export function parseSetSpaceVisibilityInput(
  raw: unknown
): SetSpaceVisibilityInput {
  const record = asObjectRecord(raw, 'set visibility input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const visibility = record['visibility'];
  if (!isSpaceVisibility(visibility)) {
    throwRulesReject([
      fail('INVALID_INPUT', { params: { message: 'visibility is required' } }),
    ]);
  }
  return { spaceId, visibility };
}

export async function authorizeSetSpaceVisibility(
  auth: RulesAuth,
  input: SetSpaceVisibilityInput,
  db: SqlClient
): Promise<void> {
  await authorizeSpaceHost(
    auth,
    db,
    input.spaceId,
    'Only the host can change visibility'
  );
  if (input.visibility !== 'private' && auth.accountId === null) {
    throwRulesReject([fail(SIGN_IN_REQUIRED)]);
  }
}

export function setVisibilityBeforeBatch(
  input: SetSpaceVisibilityInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'patch',
        table: SPACES_TABLE.tableName,
        id: input.spaceId,
        values: { visibility: input.visibility },
      },
    ],
  };
}

export async function setSpaceVisibility(
  auth: RulesAuth,
  input: SetSpaceVisibilityInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  const memberId = resolveSpaceMemberId(accountId);
  await db.run(
    sqlMap({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.visibility]: input.visibility,
        [SpaceCol.hostId]: auth.deviceId,
        [SpaceCol.hostMemberId]: memberId,
      },
      where: ['=', SpaceCol.id, input.spaceId],
    })
  );
}
