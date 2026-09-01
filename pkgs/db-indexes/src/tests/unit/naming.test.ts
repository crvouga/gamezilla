import { describe, expect, test } from 'bun:test';
import type { IndexDefinition } from '../../index';
import {
  canonicalDefinition,
  definitionsEqual,
  fingerprintSql,
  isOwnedName,
  normalizeSql,
  ownedIndexName,
} from '../../index';

describe('naming', () => {
  test('equal definitions → same name', () => {
    const a: IndexDefinition = {
      table: 'friends_requests',
      columns: [{ name: 'from_user_id', order: 'asc' }],
      include: [],
      predicate: null,
    };
    const b: IndexDefinition = {
      table: 'friends_requests',
      columns: [{ name: 'from_user_id', order: 'asc' }],
      include: [],
      predicate: null,
    };
    expect(ownedIndexName(a)).toBe(ownedIndexName(b));
    expect(definitionsEqual(a, b)).toBe(true);
    expect(isOwnedName(ownedIndexName(a))).toBe(true);
  });

  test('different definitions → different names', () => {
    const a: IndexDefinition = {
      table: 'friends_requests',
      columns: [{ name: 'from_user_id', order: 'asc' }],
      include: [],
      predicate: null,
    };
    const b: IndexDefinition = {
      table: 'friends_requests',
      columns: [{ name: 'to_user_id', order: 'asc' }],
      include: [],
      predicate: null,
    };
    expect(ownedIndexName(a)).not.toBe(ownedIndexName(b));
    expect(canonicalDefinition(a)).not.toBe(canonicalDefinition(b));
  });

  test('include and predicate affect name', () => {
    const base: IndexDefinition = {
      table: 'notes',
      columns: [{ name: 'user_id', order: 'asc' }],
      include: [],
      predicate: null,
    };
    const withInclude: IndexDefinition = {
      ...base,
      include: ['title'],
    };
    const withPred: IndexDefinition = {
      ...base,
      predicate: 'deleted_at IS NULL',
    };
    expect(ownedIndexName(base)).not.toBe(ownedIndexName(withInclude));
    expect(ownedIndexName(base)).not.toBe(ownedIndexName(withPred));
  });
});

describe('fingerprint', () => {
  test('whitespace and comments do not change fingerprint', () => {
    const a = 'SELECT id FROM users WHERE user_id = ?';
    const b = `SELECT  id  FROM  users
      -- comment
      WHERE user_id = ?`;
    expect(fingerprintSql(a)).toBe(fingerprintSql(b));
    expect(normalizeSql(a)).toBe(normalizeSql(b));
  });

  test('IN list arity collapsed', () => {
    const a = 'SELECT id FROM t WHERE id IN (?, ?)';
    const b = 'SELECT id FROM t WHERE id IN (?, ?, ?)';
    expect(fingerprintSql(a)).toBe(fingerprintSql(b));
  });
});
