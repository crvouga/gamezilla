import { describe, expect, test } from 'bun:test';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import { stripServerOwnedProfileUploadColumns } from './strip-server-owned-profile-upload-columns';

describe('stripServerOwnedProfileUploadColumns', () => {
  test('removes username columns from profiles patches', () => {
    const stripped = stripServerOwnedProfileUploadColumns({
      op: 'patch',
      table: PROFILES_TABLE.tableName,
      id: 'p1',
      values: {
        username: 'Assigned',
        avatar_config: '{"style":"bottts"}',
      },
    });
    expect(stripped.values).toEqual({
      avatar_config: '{"style":"bottts"}',
    });
  });

  test('username-only profile patch becomes empty values', () => {
    const stripped = stripServerOwnedProfileUploadColumns({
      op: 'patch',
      table: PROFILES_TABLE.tableName,
      id: 'p1',
      values: {
        username: 'Assigned',
        username_changed_at: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(stripped.values).toEqual({});
  });

  test('leaves non-profile rows unchanged', () => {
    const row = {
      op: 'patch' as const,
      table: 'spaces',
      id: 's1',
      values: { username: 'x' },
    };
    expect(stripServerOwnedProfileUploadColumns(row)).toEqual(row);
  });
});
