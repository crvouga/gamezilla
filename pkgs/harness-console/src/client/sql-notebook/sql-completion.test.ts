import { describe, expect, test } from 'bun:test';

import { applyCompletion, completeAt } from './sql-completion';

describe('completeAt', () => {
  const catalog = {
    keywords: ['select', 'from', 'where'],
    tables: ['auth_users', 'auth_devices'],
    columns: ['user_id', 'username'],
  };

  test('prefix matches', () => {
    const r = completeAt('SEL', 3, catalog);
    expect(r?.candidates.map((c) => c.label)).toEqual(['select']);
    expect(r?.replaceStart).toBe(0);
  });

  test('tables and columns', () => {
    const r = completeAt('FROM auth_', 10, catalog);
    expect(r?.candidates.map((c) => c.label)).toEqual([
      'auth_devices',
      'auth_users',
    ]);
  });

  test('empty prefix yields null', () => {
    expect(completeAt('SELECT ', 7, catalog)).toBeNull();
  });

  test('applyCompletion', () => {
    const r = completeAt('SEL', 3, catalog)!;
    const { next, caret } = applyCompletion('SEL', r, 'select');
    expect(next).toBe('select');
    expect(caret).toBe(6);
  });
});
