import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { classify, sqlTextForAst } from '@pkgs/sync-engine-shared-ts/classify';

test('bound page limits remain read statements in both supported dialects', () => {
  // regression: bound-page-limit-not-classified-as-read
  const first = sql`SELECT * FROM puzzle_content_attempts WHERE owner_id = ${'alice'} ORDER BY activity_order DESC, updated_at DESC, id DESC LIMIT ${32} OFFSET ${0}`;
  const later = sql`SELECT * FROM puzzle_content_attempts WHERE owner_id = ${'bob'} ORDER BY activity_order DESC, updated_at DESC, id DESC LIMIT ${16} OFFSET ${64}`;
  expect(sqlTextForAst(first)).toBe(sqlTextForAst(later));
  for (const dialect of ['postgresql', 'sqlite'] as const)
    expect(classify(first, dialect)).toEqual({
      kind: 'read',
      tables: ['puzzle_content_attempts'],
      selectsStar: true,
      hasDeletedAtColumn: true,
      hasDeletedAtPredicate: false,
      hasLimit: true,
    });
});
