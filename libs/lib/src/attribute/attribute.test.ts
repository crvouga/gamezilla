import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  ATTRIBUTE_KEY_MAX_LENGTH,
  ATTRIBUTE_NAMESPACE_MAX_SEGMENTS,
  ATTRIBUTE_SEGMENT_MAX_LENGTH,
  createAttrNamespace,
  isClojureNamespacedKey,
} from './attribute';

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

describe('isClojureNamespacedKey', () => {
  it('accepts kebab-case Clojure-style keys', () => {
    expect(isClojureNamespacedKey('todo/title')).toBe(true);
    expect(isClojureNamespacedKey('my.namespace/attr-name')).toBe(true);
    expect(isClojureNamespacedKey('patch/sync-rejected-at')).toBe(true);
    expect(isClojureNamespacedKey('chess.puzzle/id')).toBe(true);
    expect(isClojureNamespacedKey('chat.message/space-id')).toBe(true);
  });

  it('rejects camelCase, underscores, digits-first, multi-slash', () => {
    expect(isClojureNamespacedKey('bad key/x')).toBe(false);
    expect(isClojureNamespacedKey('0prefix/name')).toBe(false);
    expect(isClojureNamespacedKey('prefix/9nope')).toBe(false);
    expect(isClojureNamespacedKey('onlyOne')).toBe(false);
    expect(isClojureNamespacedKey('a/b/c')).toBe(false);
    expect(isClojureNamespacedKey('foo..bar/x')).toBe(false);
    expect(isClojureNamespacedKey('.foo/x')).toBe(false);
    expect(isClojureNamespacedKey('foo./x')).toBe(false);
    expect(isClojureNamespacedKey('ns/foo.bar')).toBe(false);
    expect(isClojureNamespacedKey('patch/syncRejectedAt')).toBe(false);
    expect(isClojureNamespacedKey('MyNs/foo')).toBe(false);
    expect(isClojureNamespacedKey('ns/foo_bar')).toBe(false);
  });

  it('rejects single-character namespace or local segments', () => {
    expect(isClojureNamespacedKey('a/b')).toBe(false);
    expect(isClojureNamespacedKey('ab/c')).toBe(false);
    expect(isClojureNamespacedKey('abc/d')).toBe(false);
  });

  it('rejects non-ASCII and invisible Unicode even when shape looks valid', () => {
    expect(isClojureNamespacedKey('to\u200Bdo/title')).toBe(false);
    expect(isClojureNamespacedKey('patch/sync-réjected')).toBe(false);
  });

  it('rejects keys longer than ATTRIBUTE_KEY_MAX_LENGTH', () => {
    const seg64 = 'ab'.repeat(32);
    const prefix = `${seg64}.${seg64}.${seg64}`;
    const key = `${prefix}/${seg64}`;
    expect(key.length).toBeGreaterThan(ATTRIBUTE_KEY_MAX_LENGTH);
    expect(isClojureNamespacedKey(key)).toBe(false);
  });

  it('rejects oversized segments', () => {
    const seg = 'x'.repeat(ATTRIBUTE_SEGMENT_MAX_LENGTH + 1);
    expect(isClojureNamespacedKey(`${seg}/yz`)).toBe(false);
    expect(isClojureNamespacedKey(`ab/${seg}`)).toBe(false);
  });

  it('rejects too many dot-separated namespace segments', () => {
    const prefix = Array.from(
      { length: ATTRIBUTE_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    ).join('.');
    expect(isClojureNamespacedKey(`${prefix}/cd`)).toBe(false);
  });
});

describe('createAttrNamespace', () => {
  it('rejects zero segments', () => {
    expect(() => createAttrNamespace()).toThrow();
  });

  it('rejects invalid segment (slash)', () => {
    expect(() => createAttrNamespace('a/b')).toThrow();
  });

  it('rejects invalid segment (consecutive hyphens)', () => {
    expect(() => createAttrNamespace('a--b')).toThrow();
  });

  it('rejects digit-first segment', () => {
    expect(() => createAttrNamespace('0bad')).toThrow();
  });

  it('rejects single-character namespace segment', () => {
    expect(() => createAttrNamespace('x')).toThrow();
  });

  it('rejects camelCase segment', () => {
    expect(() => createAttrNamespace('helloWorld')).toThrow();
  });

  it('joins multiple segments with dots', () => {
    const ns = createAttrNamespace('chess', 'main-menu');
    expect(ns.prefix).toBe('chess.main-menu');
  });

  it('rejects empty name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('', (v) => v)).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('foo/bar', (v) => v)).toThrow();
  });

  it('rejects camelCase local name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('displayName', (v) => v)).toThrow();
  });

  it('rejects single-character local name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('x', (v) => v)).toThrow();
  });

  it('builds full key as prefix/name', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): string | null =>
      typeof v === 'string' ? v : null
    );
    expect(Selected.key).toBe('games/selected');
  });

  it('callable builds single-key patch', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected('chess')).toEqual({ 'games/selected': 'chess' });
    expect(Selected('nope')).toEqual({ 'games/selected': null });
  });

  it('.parse validates raw value without wrapping', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected.parse('chess')).toBe('chess');
    expect(Selected.parse('nope')).toBe(null);
  });

  it('.from reads flat key and parses', () => {
    const ns = createAttrNamespace('profile');
    const DisplayName = ns('display-name', (v): string =>
      typeof v === 'string' ? v : ''
    );
    expect(DisplayName.from({ 'profile/display-name': 'Ada' })).toBe('Ada');
    expect(DisplayName.from({})).toBe('');
  });

  it('parser throw propagates from callable', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected('x')).toThrow('bad');
  });

  it('parser throw propagates from .from', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected.from({ 'games/selected': 1 })).toThrow('bad');
  });

  it('parser throw propagates from .parse', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected.parse(1)).toThrow('bad');
  });
});
