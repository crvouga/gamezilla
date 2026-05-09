import { Assert } from '@gamezilla/lib/assert';
import { describe, expect, test } from 'bun:test';
import { assertEntityType, assertQuery } from './interface';

const validation = Assert.validation();

describe('assertEntityType', () => {
  test.each(['todo', 'todo-list', 'chess.puzzle'])(
    'accepts %s',
    (entityType) => {
      expect(() => assertEntityType(entityType, validation)).not.toThrow();
    }
  );

  const rejects = ['Profile', 'bad_type', 'a', 'foo/bar', ''] as const;
  for (const entityType of rejects) {
    test(`rejects ${entityType === '' ? '(empty)' : entityType}`, () => {
      expect(() => assertEntityType(entityType, validation)).toThrow();
    });
  }
});

describe('assertQuery entityType', () => {
  test('accepts valid entityType', () => {
    expect(() =>
      assertQuery(validation, { entityType: 'todo-list' })
    ).not.toThrow();
  });

  test('omits validation when entityType undefined', () => {
    expect(() => assertQuery(validation, {})).not.toThrow();
  });

  test('rejects invalid entityType', () => {
    expect(() => assertQuery(validation, { entityType: 'Bad' })).toThrow();
  });
});
