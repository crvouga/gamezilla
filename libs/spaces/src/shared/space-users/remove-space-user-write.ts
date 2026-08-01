import {
  SPACE_USERS_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireNonEmptyString,
} from '../space-write-helpers';

export type RemoveSpaceUserInput = {
  readonly spaceId: string;
  readonly userId: string;
};

export function parseRemoveSpaceUserInput(raw: unknown): RemoveSpaceUserInput {
  const record = asObjectRecord(raw, 'remove space user input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const userId = requireNonEmptyString(record['userId'], 'userId');
  return { spaceId, userId };
}

export async function authorizeRemoveSpaceUser(
  auth: AppRulesAuth,
  input: RemoveSpaceUserInput,
  db: SqlClient
): Promise<void> {
  await authorizeSpaceHost(
    auth,
    db,
    input.spaceId,
    'Only the host can manage space users'
  );
}

export function removeSpaceUserBeforeBatch(
  input: RemoveSpaceUserInput
): UploadBatch {
  return {
    rows: [
      {
        op: 'delete',
        table: SPACE_USERS_TABLE.tableName,
        id: spaceUserEntityId(input.spaceId, input.userId),
      },
    ],
  };
}

export async function removeSpaceUser(
  _auth: AppRulesAuth,
  input: RemoveSpaceUserInput,
  db: SqlClient
): Promise<void> {
  const id = spaceUserEntityId(input.spaceId, input.userId);
  await db.run(
    sqlMap({
      deleteFrom: SPACE_USERS_TABLE.tableName,
      where: ['=', SpaceUserCol.id, id],
    })
  );
}
