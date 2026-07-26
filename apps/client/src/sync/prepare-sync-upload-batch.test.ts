import { describe, expect, test } from 'bun:test';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import { prepareSyncUploadBatch } from './sync-api';

describe('prepareSyncUploadBatch', () => {
  test('drops username-only profile patches so they are not uploaded', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'patch',
          table: PROFILES_TABLE.tableName,
          id: 'p1',
          values: { [ProfileCol.username]: 'Assigned' },
        },
      ],
    });
    expect(prepared.rows).toEqual([]);
  });

  test('keeps avatar patches after stripping username', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'patch',
          table: PROFILES_TABLE.tableName,
          id: 'p1',
          values: {
            [ProfileCol.username]: 'Assigned',
            [ProfileCol.avatarConfig]: '{"style":"bottts"}',
          },
        },
      ],
    });
    expect(prepared.rows).toEqual([
      {
        op: 'patch',
        table: PROFILES_TABLE.tableName,
        id: 'p1',
        values: { [ProfileCol.avatarConfig]: '{"style":"bottts"}' },
      },
    ]);
  });
});
