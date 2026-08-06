import { describe, expect, test } from 'bun:test';

import { sqliteWireValue } from './merge-upsert';

describe('sqliteWireValue', () => {
  test('passes through primitives', () => {
    expect(sqliteWireValue(null)).toBe(null);
    expect(sqliteWireValue(undefined)).toBe(null);
    expect(sqliteWireValue('fen')).toBe('fen');
    expect(sqliteWireValue(1200)).toBe(1200);
  });

  test('maps boolean and Date', () => {
    expect(sqliteWireValue(true)).toBe(1);
    expect(sqliteWireValue(false)).toBe(0);
    expect(sqliteWireValue(new Date('2020-01-02T03:04:05.000Z'))).toBe(
      '2020-01-02T03:04:05.000Z'
    );
  });

  test('json-stringifies objects and arrays (postgres jsonb wire)', () => {
    expect(sqliteWireValue(['mate', 'endgame'])).toBe('["mate","endgame"]');
    expect(sqliteWireValue({ a: 1 })).toBe('{"a":1}');
  });
});
