import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import {
  normalizeSqliteType,
  PG_TYPE_SQL,
  PG_UDT_TO_TOKEN,
  pgTypeToToken,
  SQLITE_TYPE_SQL,
  sqlitePhysicalOf,
} from './type-map';
import { COLUMN_TYPES, type ColumnType } from './types';

describe('type-map properties', () => {
  test('known ColumnType maps are total', () => {
    assertProperty(
      'ColumnType has PG + SQLite mappings',
      fc.property(fc.constantFrom(...COLUMN_TYPES), (token: ColumnType) => {
        expect(typeof PG_TYPE_SQL[token]).toBe('string');
        expect(sqlitePhysicalOf(token)).toBe(SQLITE_TYPE_SQL[token]);
        expect(['TEXT', 'INTEGER']).toContain(sqlitePhysicalOf(token));
      })
    );
  });

  test('pgTypeToToken recognizes known PG udt names', () => {
    assertProperty(
      'pgTypeToToken round-trip',
      fc.property(fc.constantFrom(...COLUMN_TYPES), (token: ColumnType) => {
        const sql = PG_TYPE_SQL[token];
        const udt =
          token === 'timestamp'
            ? 'timestamptz'
            : token === 'integer'
              ? 'int8'
              : token === 'boolean'
                ? 'bool'
                : token === 'json'
                  ? 'jsonb'
                  : sql;
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
          if (declared === 'TEXT' || declared === 'INTEGER') {
            expect(norm).toBe(declared);
          } else {
            expect(norm).toBeNull();
          }
        }
      )
    );
  });
});
