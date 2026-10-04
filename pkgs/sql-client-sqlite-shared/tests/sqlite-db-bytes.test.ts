import { describe, expect, test } from 'bun:test';

import {
  assertSqliteDbHeader,
  coerceSqliteDbBytes,
  isNotADatabaseError,
} from '@pkgs/sql-client-sqlite-shared/sqlite-db-bytes';

function fakeSqliteBytes(size = 128): Uint8Array {
  const bytes = new Uint8Array(size);
  const header = 'SQLite format 3\0';
  for (let i = 0; i < 16; i++) bytes[i] = header.charCodeAt(i);
  return bytes;
}

describe('sqlite-db-bytes', () => {
  test('coerce accepts Uint8Array with valid header', () => {
    const src = fakeSqliteBytes();
    const out = coerceSqliteDbBytes(src);
    expect(out).not.toBe(src);
    expect(out.byteLength).toBe(src.byteLength);
    expect([...out.subarray(0, 15)]).toEqual([...src.subarray(0, 15)]);
  });

  test('coerce accepts ArrayBuffer view with offset', () => {
    const buf = new ArrayBuffer(200);
    const view = new Uint8Array(buf, 16, 128);
    view.set(fakeSqliteBytes(128));
    const out = coerceSqliteDbBytes(view);
    expect(out.byteLength).toBe(128);
    assertSqliteDbHeader(out);
  });

  test('coerce rejects non-sqlite payload', () => {
    expect(() => coerceSqliteDbBytes(new Uint8Array([1, 2, 3]))).toThrow(
      /too short|missing header/
    );
    expect(() =>
      coerceSqliteDbBytes(new TextEncoder().encode('not-db'))
    ).toThrow(/too short|missing header/);
    const bad = fakeSqliteBytes();
    bad[0] = 0;
    expect(() => coerceSqliteDbBytes(bad)).toThrow(/missing header/);
  });

  test('isNotADatabaseError matches SQLite messages', () => {
    expect(
      isNotADatabaseError(new Error('Error code 26: file is not a database'))
    ).toBe(true);
    expect(isNotADatabaseError(new Error('syntax error'))).toBe(false);
  });
});
