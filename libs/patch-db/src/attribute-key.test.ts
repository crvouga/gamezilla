import { describe, expect, test } from 'bun:test';
import { isValidPatchDbAttributeKey } from './attribute-key';

describe('isValidPatchDbAttributeKey', () => {
  test('accepts namespaced keys', () => {
    expect(isValidPatchDbAttributeKey('todo/title')).toBe(true);
    expect(isValidPatchDbAttributeKey('my.namespace/attr')).toBe(true);
    expect(isValidPatchDbAttributeKey('patch/syncRejectedAt')).toBe(true);
  });

  test('rejects invalid keys', () => {
    expect(isValidPatchDbAttributeKey('bad key/x')).toBe(false);
    expect(isValidPatchDbAttributeKey('0prefix/name')).toBe(false);
    expect(isValidPatchDbAttributeKey('prefix/9nope')).toBe(false);
    expect(isValidPatchDbAttributeKey('onlyOne')).toBe(false);
    expect(isValidPatchDbAttributeKey('a/b/c')).toBe(false);
  });
});
