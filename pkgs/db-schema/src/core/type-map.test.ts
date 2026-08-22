import { describe, expect, test } from 'bun:test';
import { pgTypeToToken } from './type-map';

describe('pgTypeToToken', () => {
  test('maps int4 and integer to logical integer', () => {
    expect(pgTypeToToken('int4', 'integer')).toBe('integer');
    expect(pgTypeToToken('INT4', 'INTEGER')).toBe('integer');
  });

  test('maps int8 and bigint to logical integer', () => {
    expect(pgTypeToToken('int8', 'bigint')).toBe('integer');
  });
});
