import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import {
  normalizeSqliteType,
  PG_TYPE_SQL,
  PG_UDT_TO_TOKEN,
  pgTypeToToken,
  SQLITE_TYPE_SQL,
  sqlitePhysicalOf,
} from './type-map';
import { COLUMN_TYPES, type ColumnType } from './types';

function udtForToken(token: ColumnType): string {
  switch (token) {
    case 'timestamp':
      return 'timestamptz';
    case 'integer':
      return 'int8';
    case 'boolean':
      return 'bool';
    case 'json':
      return 'jsonb';
    case 'real':
      return 'float8';
    case 'blob':
      return 'bytea';
    default:
      return PG_TYPE_SQL[token];
  }
}

describe('type-map properties', () => {
  test('known ColumnType maps are total', () => {
    assertProperty(
      'ColumnType has PG + SQLite mappings',
      fc.property(fc.constantFrom(...COLUMN_TYPES), (token: ColumnType) => {
        expect(typeof PG_TYPE_SQL[token]).toBe('string');
        expect(sqlitePhysicalOf(token)).toBe(SQLITE_TYPE_SQL[token]);
        expect(['TEXT', 'INTEGER', 'REAL', 'BLOB']).toContain(
          sqlitePhysicalOf(token)
        );
      })
    );
  });

  test('pgTypeToToken recognizes known PG udt names', () => {
    assertProperty(
      'pgTypeToToken round-trip',
      fc.property(fc.constantFrom(...COLUMN_TYPES), (token: ColumnType) => {
        const sql = PG_TYPE_SQL[token];
        const udt = udtForToken(token);
        expect(pgTypeToToken(udt, sql)).toBe(token);
      })
    );
  });

  test('unknown UDT → null; normalizeSqliteType is strict', () => {
    assertProperty(
      'unknown types rejected',
      fc.property(
        fc
          .stringMatching(/^[a-z]{3,8}$/)
          .filter((udt) => !(udt in PG_UDT_TO_TOKEN)),
        fc.constantFrom('TEXT', 'INTEGER', 'BLOB', 'REAL', 'FOO'),
        (udt, declared) => {
          expect(pgTypeToToken(udt, 'USER-DEFINED')).toBeNull();
          const norm = normalizeSqliteType(declared);
          if (
            declared === 'TEXT' ||
            declared === 'INTEGER' ||
            declared === 'BLOB' ||
            declared === 'REAL'
          ) {
            expect(norm).toBe(declared);
          } else {
            expect(norm).toBeNull();
          }
        }
      )
    );
  });
});
