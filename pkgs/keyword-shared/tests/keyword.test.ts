/**
 * Spec pins: concrete keywords and exact bounds the wire contract names, and
 * compile-time brand checks. The general laws live in keyword.property.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Assert } from '@pkgs/assert-shared/assert';
import type { JoinDot, Keyword } from '@pkgs/keyword-shared/keyword';
import {
  asKeyword,
  CLOJURE_NAMESPACED_KEYWORD_REGEX,
  isNamespacedKeyword,
  joinKeywordSegments,
  KEYWORD_MAX_LENGTH,
  KEYWORD_NAMESPACE_MAX_SEGMENTS,
  KEYWORD_SEGMENT_MAX_LENGTH,
  KEYWORD_SEGMENT_MIN_LENGTH,
} from '@pkgs/keyword-shared/keyword';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message) {
      throw new Error(message);
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

/** `ab.ab.…/cd` with `count` namespace segments. */
function keyWithSegments(count: number): string {
  return `${Array.from({ length: count }, () => 'ab').join('.')}/cd`;
}

/** Valid keyword of exactly `total` code units: max-length segments + a tail. */
function keyOfLength(total: number): string {
  const local = 'x'.repeat(KEYWORD_SEGMENT_MIN_LENGTH);
  const full = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH);
  const segments: string[] = [];
  let remaining = total - 1 - local.length;
  while (
    remaining >
    KEYWORD_SEGMENT_MAX_LENGTH + 1 + KEYWORD_SEGMENT_MIN_LENGTH
  ) {
    segments.push(full);
    remaining -= KEYWORD_SEGMENT_MAX_LENGTH + 1;
  }
  segments.push('x'.repeat(remaining));
  return `${segments.join('.')}/${local}`;
}

describe('wire bounds', () => {
  it('pins the published limits', () => {
    expect(KEYWORD_SEGMENT_MIN_LENGTH).toBe(2);
    expect(KEYWORD_SEGMENT_MAX_LENGTH).toBe(64);
    expect(KEYWORD_NAMESPACE_MAX_SEGMENTS).toBe(16);
    expect(KEYWORD_MAX_LENGTH).toBe(256);
  });

  it('accepts a key of exactly KEYWORD_MAX_LENGTH and rejects one more', () => {
    const key = keyOfLength(KEYWORD_MAX_LENGTH);
    expect(key.length).toBe(KEYWORD_MAX_LENGTH);
    expect(isNamespacedKeyword(key)).toBe(true);
    expect(isNamespacedKeyword(`${key}x`)).toBe(false);
  });

  it('accepts the maximum namespace segment count and rejects one more', () => {
    expect(isNamespacedKeyword(keyWithSegments(16))).toBe(true);
    expect(isNamespacedKeyword(keyWithSegments(17))).toBe(false);
  });

  it('refuses a joined prefix that leaves no room for `/` + a minimal local', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH);
    expect(() => joinKeywordSegments(seg, seg, seg, seg)).toThrow();
  });
});

describe('concrete keywords', () => {
  it('accepts the shapes product code uses', () => {
    for (const key of [
      'todo/title',
      'patch/sync-rejected-at',
      'chess.puzzle/id',
      'room.wire.s2c/welcome',
    ]) {
      expect(isNamespacedKeyword(key)).toBe(true);
    }
  });

  it('rejects camelCase, snake_case, single-char and unicode keys', () => {
    for (const key of [
      'patch/syncRejectedAt',
      'ns/foo_bar',
      'a/bc',
      'todo/тitle',
      'to​do/title',
    ]) {
      expect(isNamespacedKeyword(key)).toBe(false);
    }
  });

  it('shape regex is stricter than the predicate on 1-char-then-hyphen segments', () => {
    for (const key of ['a-b/c-d', 'ax/c-d']) {
      expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test(key)).toBe(false);
      expect(isNamespacedKeyword(key)).toBe(true);
    }
  });
});

describe('types', () => {
  it('asKeyword preserves the literal type', () => {
    const k = asKeyword('todo/title');
    const literalCheck: 'todo/title' & Keyword = k;
    expect(literalCheck as string).toBe('todo/title');
  });

  it('joinKeywordSegments preserves a precise template literal type', () => {
    const joined = joinKeywordSegments('chess', 'main-menu');
    const literalCheck: 'chess.main-menu' = joined;
    expect(literalCheck).toBe('chess.main-menu');
    const _explicit: JoinDot<['a', 'b']> = 'a.b';
    void _explicit;
  });

  it('Keyword brand refuses raw strings at compile time', () => {
    // @ts-expect-error: raw strings cannot be assigned to a branded Keyword.
    const _literal: Keyword = 'todo/title';
    const raw: string = 'todo/title';
    // @ts-expect-error: an unbranded string variable cannot be assigned to Keyword.
    const _variable: Keyword = raw;
    void _literal;
    void _variable;
  });
});
