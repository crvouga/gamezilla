import { SPACES_TABLE } from '@libs/db/shared/space-tables';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireNonEmptyString,
} from '../space-write-helpers';
import { executeEndSpace, type EndSpaceInput } from './execute-end-space';

export type { EndSpaceInput };

export function parseEndSpaceInput(raw: unknown): EndSpaceInput {
  const record = asObjectRecord(raw, 'end space input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  return { spaceId };
}

export async function authorizeEndSpace(
  auth: AppRulesAuth,
  input: EndSpaceInput,
  db: SqlClient
): Promise<void> {
  await authorizeSpaceHost(
    auth,
    db,
    input.spaceId,
    'Only the host can end this space'
  );
}

export function endSpaceBeforeBatch(input: EndSpaceInput): UploadBatch {
  return {
    rows: [
      {
        op: 'patch',
        table: SPACES_TABLE.tableName,
        id: input.spaceId,
        values: { ended_at: 'pending' },
      },
    ],
  };
}

export { executeEndSpace };
