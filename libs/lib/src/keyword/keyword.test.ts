import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  isNamespacedKeyword,
  joinKeywordSegments,
  KEYWORD_MAX_LENGTH,
  KEYWORD_NAMESPACE_MAX_SEGMENTS,
  KEYWORD_SEGMENT_MAX_LENGTH,
} from './keyword';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

describe('isNamespacedKeyword', () => {
  it('accepts kebab-case Clojure-style keys', () => {
    expect(isNamespacedKeyword('todo/title')).toBe(true);
    expect(isNamespacedKeyword('my.namespace/attr-name')).toBe(true);
    expect(isNamespacedKeyword('patch/sync-rejected-at')).toBe(true);
    expect(isNamespacedKeyword('chess.puzzle/id')).toBe(true);
    expect(isNamespacedKeyword('chat.message/space-id')).toBe(true);
  });

  it('rejects camelCase, underscores, digits-first, multi-slash', () => {
    expect(isNamespacedKeyword('bad key/x')).toBe(false);
    expect(isNamespacedKeyword('0prefix/name')).toBe(false);
    expect(isNamespacedKeyword('prefix/9nope')).toBe(false);
    expect(isNamespacedKeyword('onlyOne')).toBe(false);
    expect(isNamespacedKeyword('a/b/c')).toBe(false);
    expect(isNamespacedKeyword('foo..bar/x')).toBe(false);
    expect(isNamespacedKeyword('.foo/x')).toBe(false);
    expect(isNamespacedKeyword('foo./x')).toBe(false);
    expect(isNamespacedKeyword('ns/foo.bar')).toBe(false);
    expect(isNamespacedKeyword('patch/syncRejectedAt')).toBe(false);
    expect(isNamespacedKeyword('MyNs/foo')).toBe(false);
    expect(isNamespacedKeyword('ns/foo_bar')).toBe(false);
  });

  it('rejects single-character namespace or local segments', () => {
    expect(isNamespacedKeyword('a/b')).toBe(false);
    expect(isNamespacedKeyword('ab/c')).toBe(false);
    expect(isNamespacedKeyword('abc/d')).toBe(false);
  });

  it('rejects non-ASCII and invisible Unicode even when shape looks valid', () => {
    expect(isNamespacedKeyword('to\u200Bdo/title')).toBe(false);
    expect(isNamespacedKeyword('patch/sync-réjected')).toBe(false);
  });

  it('rejects keys longer than KEYWORD_MAX_LENGTH', () => {
    const seg64 = 'ab'.repeat(32);
    const prefix = `${seg64}.${seg64}.${seg64}`;
    const key = `${prefix}/${seg64}`;
    expect(key.length).toBeGreaterThan(KEYWORD_MAX_LENGTH);
    expect(isNamespacedKeyword(key)).toBe(false);
  });

  it('rejects oversized segments', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1);
    expect(isNamespacedKeyword(`${seg}/yz`)).toBe(false);
    expect(isNamespacedKeyword(`ab/${seg}`)).toBe(false);
  });

  it('rejects too many dot-separated namespace segments', () => {
    const prefix = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    ).join('.');
    expect(isNamespacedKeyword(`${prefix}/cd`)).toBe(false);
  });
});

describe('joinKeywordSegments', () => {
  it('joins segments with dots', () => {
    expect(joinKeywordSegments('chess', 'main-menu')).toBe('chess.main-menu');
  });

  it('rejects single-character segment', () => {
    expect(() => joinKeywordSegments('x')).toThrow();
  });
});
