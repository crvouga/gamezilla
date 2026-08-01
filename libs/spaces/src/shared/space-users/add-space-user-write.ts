import {
  SPACE_USERS_TABLE,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { SPACE_INVALID_INPUT } from '@libs/spaces/shared/rules/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
  upsertSpaceUserRow,
} from '../space-write-helpers';

export type AddSpaceUserInput = {
  readonly spaceId: string;
  readonly userId: string;
};

export function parseAddSpaceUserInput(raw: unknown): AddSpaceUserInput {
  const record = asObjectRecord(raw, 'add space user input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const userId = requireNonEmptyString(record['userId'], 'userId');
  return { spaceId, userId };
}

export async function authorizeAddSpaceUser(
  auth: AppRulesAuth,
  input: AddSpaceUserInput,
  db: SqlClient
): Promise<void> {
  await authorizeSpaceHost(
    auth,
    db,
    input.spaceId,
    'Only the host can manage space users'
  );
  if (input.userId === auth.accountId) {
    throwRulesReject([
      fail(SPACE_INVALID_INPUT, {
        params: { message: 'Host is already a space user' },
      }),
    ]);
  }
}

export function addSpaceUserBeforeBatch(
  auth: AppRulesAuth,
  input: AddSpaceUserInput
): UploadBatch {
  const accountId = requireAccountId(auth);
  return {
    rows: [
      {
        op: 'put',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(input.spaceId, input.userId),
        values: {
          id: spaceUserEntityId(input.spaceId, input.userId),
          space_id: input.spaceId,
          user_id: input.userId,
          created_by_account_id: accountId,
        },
      },
    ],
  };
}

export async function addSpaceUser(
  auth: AppRulesAuth,
  input: AddSpaceUserInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  await upsertSpaceUserRow({
    db,
    spaceId: input.spaceId,
    userId: input.userId,
    createdByAccountId: accountId,
  });
}
