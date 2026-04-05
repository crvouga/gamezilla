import { describe, expect, test } from 'bun:test';
import { sqliteJsonPathToKey } from './json-path';

describe('sqliteJsonPathToKey', () => {
  test('bare key', () => {
    expect(sqliteJsonPathToKey('$.foo')).toBe('foo');
  });

  test('namespaced attribute (contains /)', () => {
    expect(sqliteJsonPathToKey('$."task/title"')).toBe('task/title');
  });

  test('attribute with dot in namespace', () => {
    expect(sqliteJsonPathToKey('$."some.ns/key"')).toBe('some.ns/key');
  });

  test('attribute with dot in key', () => {
    expect(sqliteJsonPathToKey('$."ns/key.name"')).toBe('ns/key.name');
  });

  test('escaped quote inside quoted key', () => {
    expect(sqliteJsonPathToKey('$."a\\"b"')).toBe('a"b');
  });

  test('rejects empty path after $.', () => {
    expect(() => sqliteJsonPathToKey('$.')).toThrow();
  });

  test('rejects missing $. prefix', () => {
    expect(() => sqliteJsonPathToKey('foo')).toThrow();
  });
});
