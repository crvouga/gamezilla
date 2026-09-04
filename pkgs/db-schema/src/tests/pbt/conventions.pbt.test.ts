import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { defineTable } from '../../core/define-table';
import {
  assertSnakeCaseIdent,
  identByteLength,
  isReservedSchemaKeyword,
  isSnakeCase,
  RESERVED_SCHEMA_KEYWORDS,
} from '../../core/snake-case';

const VALID_IDENT = fc
  .stringMatching(/^[a-z][a-z0-9]{0,8}(_[a-z0-9]{1,4})?$/)
  .filter((s) => !isReservedSchemaKeyword(s));

describe('db-schema convention PBT', () => {
  test('isSnakeCase accepts valid generated idents', () => {
    assertProperty(
      'valid snake_case idents',
      fc.property(VALID_IDENT, (name) => {
        expect(isSnakeCase(name)).toBe(true);
        expect(() => assertSnakeCaseIdent(name, 'test')).not.toThrow();
        expect(identByteLength(name)).toBeLessThanOrEqual(63);
      })
    );
  });

  test('reserved keywords are rejected', () => {
    assertProperty(
      'sql keywords fail',
      fc.property(fc.constantFrom(...RESERVED_SCHEMA_KEYWORDS), (kw) => {
        expect(isSnakeCase(kw)).toBe(false);
        expect(() => assertSnakeCaseIdent(kw, 'test')).toThrow(/reserved/i);
      })
    );
  });

  test('camelCase and double-underscore idents are rejected', () => {
    assertProperty(
      'illegal shapes fail',
      fc.property(
        fc.constantFrom('UserIds', 'a__b', '_hidden', '9start', 'trailing_'),
        (bad) => {
          expect(isSnakeCase(bad)).toBe(false);
          expect(() => assertSnakeCaseIdent(bad, 'test')).toThrow();
        }
      )
    );
  });

  test('defineTable rejects non-snake_case table names', () => {
    assertProperty(
      'bad table names',
      fc.property(fc.constantFrom('Users', 'bad-table', 'table'), (name) => {
        expect(() =>
          defineTable({
            domain: 'notes',
            name,
            columns: { body: 'text' },
          })
        ).toThrow();
      })
    );
  });
});
