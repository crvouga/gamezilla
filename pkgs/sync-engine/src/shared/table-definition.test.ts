import { describe, expect, test } from 'bun:test';

import {
  assertLocalOnlyTableName,
  defineTable,
  LOCAL_ONLY_TABLE_NAME_RE,
} from './table-definition';

describe('defineTable localOnly naming', () => {
  test('accepts localOnly table with local_ prefix', () => {
    const table = defineTable({
      tableName: 'local_space_open_sessions',
      localOnly: true,
      columns: [
        { name: 'id', type: 'text', primaryKey: true },
        { name: 'opened_at', type: 'text' },
      ],
    });
    expect(table.localOnly).toBe(true);
    expect(LOCAL_ONLY_TABLE_NAME_RE.test(table.tableName)).toBe(true);
  });

  test('accepts synced table without local_ prefix', () => {
    const table = defineTable({
      tableName: 'spaces',
      columns: [{ name: 'id', type: 'text', primaryKey: true }],
    });
    expect(table.localOnly).toBe(false);
  });

  test('rejects localOnly without local_ prefix', () => {
    expect(() =>
      assertLocalOnlyTableName({
        tableName: 'space_open_sessions',
        localOnly: true,
      })
    ).toThrow(/localOnly table/);
  });

  test('rejects local_ prefix without localOnly', () => {
    expect(() =>
      assertLocalOnlyTableName({
        tableName: 'local_space_open_sessions',
        localOnly: false,
      })
    ).toThrow(/local_ prefix/);
  });
});
