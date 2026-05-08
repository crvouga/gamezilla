import { describe, expect, test } from 'bun:test';
import { isClojureNamespacedKey } from './attribute-key';

describe('isClojureNamespacedKey', () => {
  test('accepts namespaced keys', () => {
    expect(isClojureNamespacedKey('todo/title')).toBe(true);
    expect(isClojureNamespacedKey('my.namespace/attr-name')).toBe(true);
    expect(isClojureNamespacedKey('patch/sync-rejected-at')).toBe(true);
    expect(isClojureNamespacedKey('chess.puzzle/id')).toBe(true);
  });

  test('rejects invalid keys', () => {
    expect(isClojureNamespacedKey('bad key/x')).toBe(false);
    expect(isClojureNamespacedKey('0prefix/name')).toBe(false);
    expect(isClojureNamespacedKey('prefix/9nope')).toBe(false);
    expect(isClojureNamespacedKey('onlyOne')).toBe(false);
    expect(isClojureNamespacedKey('a/b/c')).toBe(false);
    expect(isClojureNamespacedKey('foo..bar/x')).toBe(false);
    expect(isClojureNamespacedKey('ns/foo.bar')).toBe(false);
  });
});
