import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  asKeyword,
  assertKeyword,
  assertKeywordRecord,
  assertLocalName,
  assertNamespacedKeyword,
  assertNamespacePrefix,
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_KEYWORD_REGEX,
  isKebabSegment,
  isLocalName,
  isNamespacedKeyword,
  isNamespacePrefix,
  joinKeywordSegments,
  type JoinDot,
  KEYWORD_MAX_LENGTH,
  KEYWORD_NAMESPACE_MAX_SEGMENTS,
  KEYWORD_SEGMENT_MAX_LENGTH,
  KEYWORD_SEGMENT_MIN_LENGTH,
  type Keyword,
  namespacePrefixOf,
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

const NON_STRING_VALUES: readonly unknown[] = [
  undefined,
  null,
  0,
  1,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  true,
  false,
  Symbol('todo/title'),
  10n,
  {},
  { 'todo/title': 'a' },
  [],
  ['todo/title'],
  () => 'todo/title',
  new Date(),
  /todo\/title/,
];

/**
 * Build a syntactically valid keyword whose total length is exactly `total`.
 * Distributes the namespace across as many max-length segments as needed so each
 * stays within `KEYWORD_SEGMENT_MAX_LENGTH` and the namespace stays under
 * `KEYWORD_NAMESPACE_MAX_SEGMENTS`. Asserts the construction succeeds rather
 * than silently skipping.
 */
function buildKeyAtExactLength(total: number): string {
  const local = 'x'.repeat(KEYWORD_SEGMENT_MIN_LENGTH);
  const desiredNsLen = total - 1 - local.length;
  if (desiredNsLen < KEYWORD_SEGMENT_MIN_LENGTH) {
    throw new Error(
      `cannot build keyword of length ${total}: namespace would be too short`
    );
  }
  const stride = KEYWORD_SEGMENT_MAX_LENGTH + 1;
  const fullCount = Math.floor((desiredNsLen + 1) / stride);
  const usedByFull =
    fullCount * KEYWORD_SEGMENT_MAX_LENGTH + Math.max(0, fullCount - 1);
  const remainderLen = desiredNsLen - usedByFull - (fullCount > 0 ? 1 : 0);
  const totalSegs = fullCount + (remainderLen > 0 ? 1 : 0);
  if (totalSegs > KEYWORD_NAMESPACE_MAX_SEGMENTS) {
    throw new Error(
      `cannot build keyword of length ${total}: would need ${totalSegs} segments (cap ${KEYWORD_NAMESPACE_MAX_SEGMENTS})`
    );
  }
  if (
    remainderLen > 0 &&
    (remainderLen < KEYWORD_SEGMENT_MIN_LENGTH ||
      remainderLen > KEYWORD_SEGMENT_MAX_LENGTH)
  ) {
    throw new Error(
      `cannot build keyword of length ${total}: trailing segment length ${remainderLen} out of bounds`
    );
  }
  const segMax = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH);
  const segs = Array.from({ length: fullCount }, () => segMax);
  if (remainderLen > 0) segs.push('x'.repeat(remainderLen));
  return `${segs.join('.')}/${local}`;
}

/**
 * Keywords accepted by both `isNamespacedKeyword` AND the `CLOJURE_NAMESPACED_KEYWORD_REGEX`
 * shape regex. The shape regex requires `[a-z][a-z0-9]+` per segment (≥2 alnum chars before
 * any hyphen), so single-letter-then-hyphen segments like `a-b` only pass the implementation
 * (which uses `[a-z][a-z0-9]*`).
 */
const VALID_KEYWORDS: readonly string[] = [
  'todo/title',
  'my.namespace/attr-name',
  'patch/sync-rejected-at',
  'chess.puzzle/id',
  'chat.message/space-id',
  'ab/cd',
  'a1/b2',
  'ns.sub/local-name',
  'foo.bar.baz/quux',
  'kebab-case-segment/another-kebab',
  'foo1.bar2/baz3',
];

/**
 * Keywords accepted by `isNamespacedKeyword` but rejected by the looser shape regex
 * because they have a single leading alnum char before a hyphen.
 */
const VALID_BUT_SHAPE_REGEX_REJECTS: readonly string[] = ['a-b/c-d', 'ax/c-d'];

const INVALID_KEYWORDS: readonly string[] = [
  '',
  '/',
  '/foo',
  'foo/',
  'foo//bar',
  'a/b/c',
  '//',
  ' todo/title',
  'todo/title ',
  'to do/title',
  'todo/title\n',
  'todo/title\t',
  'todo/title\r',
  'todo/title\0',
  'foo..bar/x',
  '.foo/x',
  'foo./x',
  'ns/.local',
  'ns/local.',
  'ns/foo.bar',
  'ns/foo_bar',
  'patch/syncRejectedAt',
  'MyNs/foo',
  '0prefix/name',
  'prefix/9nope',
  '-foo/bar',
  'foo-/bar',
  'ab/-cd',
  'ab/cd-',
  'a--b/cd',
  'ab/c--d',
  'onlyOne',
  'no-slash-at-all',
  'a/b',
  'ab/c',
  'a/bc',
  'ABC/def',
  'abc/DEF',
  'to\u200Bdo/title',
  'patch/sync-réjected',
  'todo/тitle',
  'todo/title😀',
  'todo/ti tle',
  'foo/bar?baz',
  'foo$/bar',
  'foo/bar+baz',
  'foo/bar:baz',
];

describe('constants', () => {
  it('numeric constants are positive', () => {
    expect(KEYWORD_SEGMENT_MIN_LENGTH).toBeGreaterThan(0);
    expect(KEYWORD_SEGMENT_MAX_LENGTH).toBeGreaterThan(0);
    expect(KEYWORD_NAMESPACE_MAX_SEGMENTS).toBeGreaterThan(0);
    expect(KEYWORD_MAX_LENGTH).toBeGreaterThan(0);
  });

  it('min segment length does not exceed max', () => {
    expect(KEYWORD_SEGMENT_MIN_LENGTH).toBeLessThanOrEqual(
      KEYWORD_SEGMENT_MAX_LENGTH
    );
  });

  it('keyword max length fits at minimum a "ab/cd" shaped key', () => {
    expect(KEYWORD_MAX_LENGTH).toBeGreaterThanOrEqual(
      KEYWORD_SEGMENT_MIN_LENGTH + 1 + KEYWORD_SEGMENT_MIN_LENGTH
    );
  });
});

describe('CLOJURE_KEBAB_SEGMENT', () => {
  it('matches valid single-segment kebab strings', () => {
    expect(CLOJURE_KEBAB_SEGMENT.test('a')).toBe(true);
    expect(CLOJURE_KEBAB_SEGMENT.test('ab')).toBe(true);
    expect(CLOJURE_KEBAB_SEGMENT.test('a1')).toBe(true);
    expect(CLOJURE_KEBAB_SEGMENT.test('a-b')).toBe(true);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo-bar-baz')).toBe(true);
    expect(CLOJURE_KEBAB_SEGMENT.test('a1-b2-c3')).toBe(true);
  });

  it('rejects empty, leading/trailing/consecutive hyphens, dots, slashes, casing', () => {
    expect(CLOJURE_KEBAB_SEGMENT.test('')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('-foo')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo-')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo--bar')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo.bar')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo/bar')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('Foo')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('1foo')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo_bar')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test(' foo')).toBe(false);
    expect(CLOJURE_KEBAB_SEGMENT.test('foo ')).toBe(false);
  });
});

describe('CLOJURE_NAMESPACED_KEYWORD_REGEX', () => {
  it('matches valid keywords', () => {
    for (const k of VALID_KEYWORDS) {
      expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test(k)).toBe(true);
    }
  });

  it('is stricter than isNamespacedKeyword: rejects 1-char-then-hyphen segments', () => {
    for (const k of VALID_BUT_SHAPE_REGEX_REJECTS) {
      expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test(k)).toBe(false);
      expect(isNamespacedKeyword(k)).toBe(true);
    }
  });

  it('rejects shape-invalid keywords (whitespace, missing/extra slash, hyphen edges, casing)', () => {
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('todo/title ')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test(' todo/title')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('todo title/x')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('todo/title\n')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('todo/title\t')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('a/b/c')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('onlyOne')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo./x')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('.foo/x')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('-foo/bar')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo/-bar')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo/bar-')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo--bar/x')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('Foo/bar')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo/Bar')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('1foo/bar')).toBe(false);
    expect(CLOJURE_NAMESPACED_KEYWORD_REGEX.test('foo/1bar')).toBe(false);
  });
});

describe('isKebabSegment', () => {
  it('accepts well-formed kebab segments within length bounds', () => {
    expect(isKebabSegment('ab')).toBe(true);
    expect(isKebabSegment('foo-bar')).toBe(true);
    expect(isKebabSegment('a1')).toBe(true);
    expect(isKebabSegment('a1-b2-c3')).toBe(true);
    expect(isKebabSegment('x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH))).toBe(true);
    expect(isKebabSegment('x'.repeat(KEYWORD_SEGMENT_MIN_LENGTH))).toBe(true);
  });

  it('rejects under-length segments (single-char)', () => {
    expect(isKebabSegment('a')).toBe(false);
    expect(isKebabSegment('z')).toBe(false);
    expect(isKebabSegment('')).toBe(false);
  });

  it('rejects over-length segments', () => {
    expect(isKebabSegment('x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1))).toBe(
      false
    );
  });

  it('rejects shape violations', () => {
    expect(isKebabSegment('-ab')).toBe(false);
    expect(isKebabSegment('ab-')).toBe(false);
    expect(isKebabSegment('a--b')).toBe(false);
    expect(isKebabSegment('a.b')).toBe(false);
    expect(isKebabSegment('a/b')).toBe(false);
    expect(isKebabSegment('Ab')).toBe(false);
    expect(isKebabSegment('aB')).toBe(false);
    expect(isKebabSegment('1a')).toBe(false);
    expect(isKebabSegment('a_b')).toBe(false);
    expect(isKebabSegment(' ab')).toBe(false);
    expect(isKebabSegment('ab ')).toBe(false);
    expect(isKebabSegment('a\tb')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    for (const v of NON_STRING_VALUES) {
      expect(isKebabSegment(v)).toBe(false);
    }
  });
});

describe('isNamespacePrefix', () => {
  it('accepts single and dot-separated kebab namespaces', () => {
    expect(isNamespacePrefix('ab')).toBe(true);
    expect(isNamespacePrefix('foo')).toBe(true);
    expect(isNamespacePrefix('foo.bar')).toBe(true);
    expect(isNamespacePrefix('foo.bar.baz.qux')).toBe(true);
    expect(isNamespacePrefix('foo-bar.baz-qux')).toBe(true);
  });

  it('accepts namespace with the maximum number of segments', () => {
    const prefix = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS },
      () => 'ab'
    ).join('.');
    expect(isNamespacePrefix(prefix)).toBe(true);
  });

  it('rejects namespace exceeding the maximum number of segments', () => {
    const prefix = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    ).join('.');
    expect(isNamespacePrefix(prefix)).toBe(false);
  });

  it('rejects empty, leading/trailing/consecutive dots', () => {
    expect(isNamespacePrefix('')).toBe(false);
    expect(isNamespacePrefix('.foo')).toBe(false);
    expect(isNamespacePrefix('foo.')).toBe(false);
    expect(isNamespacePrefix('foo..bar')).toBe(false);
    expect(isNamespacePrefix('.')).toBe(false);
    expect(isNamespacePrefix('..')).toBe(false);
  });

  it('rejects single-char segments anywhere in the prefix', () => {
    expect(isNamespacePrefix('a')).toBe(false);
    expect(isNamespacePrefix('a.bc')).toBe(false);
    expect(isNamespacePrefix('ab.c')).toBe(false);
    expect(isNamespacePrefix('ab.cd.e')).toBe(false);
  });

  it('rejects oversized segments', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1);
    expect(isNamespacePrefix(seg)).toBe(false);
    expect(isNamespacePrefix(`ab.${seg}`)).toBe(false);
  });

  it('rejects prefix containing a slash', () => {
    expect(isNamespacePrefix('foo/bar')).toBe(false);
    expect(isNamespacePrefix('foo/')).toBe(false);
  });

  it('rejects shape violations (casing, digits-first, underscores, whitespace)', () => {
    expect(isNamespacePrefix('Foo')).toBe(false);
    expect(isNamespacePrefix('foo.Bar')).toBe(false);
    expect(isNamespacePrefix('1foo')).toBe(false);
    expect(isNamespacePrefix('foo.1bar')).toBe(false);
    expect(isNamespacePrefix('foo_bar')).toBe(false);
    expect(isNamespacePrefix(' foo')).toBe(false);
    expect(isNamespacePrefix('foo ')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    for (const v of NON_STRING_VALUES) {
      expect(isNamespacePrefix(v)).toBe(false);
    }
  });
});

describe('isLocalName', () => {
  it('accepts kebab-case local names within length bounds', () => {
    expect(isLocalName('ab')).toBe(true);
    expect(isLocalName('foo-bar')).toBe(true);
    expect(isLocalName('a1')).toBe(true);
    expect(isLocalName('x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH))).toBe(true);
  });

  it('rejects single-char and empty local names', () => {
    expect(isLocalName('a')).toBe(false);
    expect(isLocalName('')).toBe(false);
  });

  it('rejects local names containing dots or slashes', () => {
    expect(isLocalName('foo.bar')).toBe(false);
    expect(isLocalName('foo/bar')).toBe(false);
  });

  it('rejects oversized local names', () => {
    expect(isLocalName('x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1))).toBe(false);
  });

  it('rejects non-string inputs', () => {
    for (const v of NON_STRING_VALUES) {
      expect(isLocalName(v)).toBe(false);
    }
  });
});

describe('isNamespacedKeyword: positive cases', () => {
  it('accepts every value in VALID_KEYWORDS', () => {
    for (const k of VALID_KEYWORDS) {
      expect(isNamespacedKeyword(k)).toBe(true);
    }
  });

  it('accepts a key whose total length is exactly KEYWORD_MAX_LENGTH', () => {
    const key = buildKeyAtExactLength(KEYWORD_MAX_LENGTH);
    expect(key.length).toBe(KEYWORD_MAX_LENGTH);
    expect(isNamespacedKeyword(key)).toBe(true);
  });

  it('accepts namespace at the maximum segment count', () => {
    const prefix = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS },
      () => 'ab'
    ).join('.');
    expect(isNamespacedKeyword(`${prefix}/cd`)).toBe(true);
  });

  it('accepts segments at the exact max segment length', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH);
    expect(isNamespacedKeyword(`${seg}/${seg}`)).toBe(true);
  });
});

describe('isNamespacedKeyword: negative cases', () => {
  it('rejects every value in INVALID_KEYWORDS', () => {
    for (const k of INVALID_KEYWORDS) {
      expect(isNamespacedKeyword(k)).toBe(false);
    }
  });

  it('rejects non-string inputs', () => {
    for (const v of NON_STRING_VALUES) {
      expect(isNamespacedKeyword(v)).toBe(false);
    }
  });

  it('rejects a key one character over KEYWORD_MAX_LENGTH', () => {
    const okKey = buildKeyAtExactLength(KEYWORD_MAX_LENGTH);
    expect(okKey.length).toBe(KEYWORD_MAX_LENGTH);
    expect(isNamespacedKeyword(`${okKey}x`)).toBe(false);
  });

  it('rejects oversized segments at exact boundary +1', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1);
    expect(isNamespacedKeyword(`${seg}/yz`)).toBe(false);
    expect(isNamespacedKeyword(`yz/${seg}`)).toBe(false);
  });

  it('rejects namespaces exceeding the segment cap', () => {
    const prefix = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    ).join('.');
    expect(isNamespacedKeyword(`${prefix}/cd`)).toBe(false);
  });

  it('rejects keys with embedded NUL or control characters', () => {
    expect(isNamespacedKeyword('todo/ti\0tle')).toBe(false);
    expect(isNamespacedKeyword('todo/ti\x07tle')).toBe(false);
    expect(isNamespacedKeyword('todo\x1F/title')).toBe(false);
  });

  it('rejects keys with surrogate pairs / emoji', () => {
    expect(isNamespacedKeyword('todo/title😀')).toBe(false);
    expect(isNamespacedKeyword('🔥/title')).toBe(false);
    expect(isNamespacedKeyword('todo/\uD83D\uDE00')).toBe(false);
  });

  it('rejects keys whose ASCII chars are valid charset but not kebab-shaped', () => {
    expect(isNamespacedKeyword('foo./bar')).toBe(false);
    expect(isNamespacedKeyword('foo/bar.')).toBe(false);
    expect(isNamespacedKeyword('foo/.bar')).toBe(false);
    expect(isNamespacedKeyword('foo/bar.baz')).toBe(false);
  });
});

describe('asKeyword / assertKeyword', () => {
  it('returns the same string instance for valid input', () => {
    const input = 'todo/title';
    expect(asKeyword(input) as string).toBe(input);
    expect(assertKeyword(input) as string).toBe(input);
  });

  it('preserves literal type as Keyword & literal', () => {
    const k = asKeyword('todo/title');
    const literalCheck: 'todo/title' & Keyword = k;
    expect(literalCheck as string).toBe('todo/title');
  });

  it('crashes on invalid input via asKeyword', () => {
    expect(() => asKeyword('bad_key/x')).toThrow();
    expect(() => asKeyword('onlyOne')).toThrow();
    expect(() => asKeyword('a/b/c')).toThrow();
    expect(() => asKeyword('')).toThrow();
    expect(() => asKeyword('/foo')).toThrow();
    expect(() => asKeyword('foo/')).toThrow();
    expect(() => asKeyword('Foo/Bar')).toThrow();
  });

  it('crashes on invalid input via assertKeyword', () => {
    expect(() => assertKeyword('camelCase/foo')).toThrow();
    expect(() => assertKeyword('foo/camelCase')).toThrow();
    expect(() => assertKeyword('foo bar/baz')).toThrow();
  });

  it('Keyword brand prevents raw string assignment at compile time', () => {
    // @ts-expect-error: raw strings cannot be assigned to a branded Keyword.
    const _bad: Keyword = 'todo/title';
    void _bad;
  });

  it('Keyword brand prevents string variable assignment at compile time', () => {
    const raw: string = 'todo/title';
    // @ts-expect-error: an unbranded string variable cannot be assigned to Keyword.
    const _bad: Keyword = raw;
    void _bad;
  });
});

describe('assertNamespacedKeyword', () => {
  it('narrows string to Keyword', () => {
    const raw: string = 'todo/title';
    assertNamespacedKeyword(raw);
    const k: Keyword = raw;
    expect(k).toBe(asKeyword('todo/title'));
  });

  it('does not throw for any value in VALID_KEYWORDS', () => {
    for (const v of VALID_KEYWORDS) {
      expect(() => assertNamespacedKeyword(v)).not.toThrow();
    }
  });

  it('throws for any value in INVALID_KEYWORDS', () => {
    for (const v of INVALID_KEYWORDS) {
      expect(() => assertNamespacedKeyword(v)).toThrow();
    }
  });
});

describe('assertNamespacePrefix', () => {
  it('does not throw for valid prefixes', () => {
    expect(() => assertNamespacePrefix('foo')).not.toThrow();
    expect(() => assertNamespacePrefix('foo.bar')).not.toThrow();
    expect(() => assertNamespacePrefix('foo.bar.baz')).not.toThrow();
    expect(() => assertNamespacePrefix('foo-bar.baz-qux')).not.toThrow();
  });

  it('throws on invalid prefixes', () => {
    expect(() => assertNamespacePrefix('')).toThrow();
    expect(() => assertNamespacePrefix('Foo')).toThrow();
    expect(() => assertNamespacePrefix('foo/bar')).toThrow();
    expect(() => assertNamespacePrefix('.foo')).toThrow();
    expect(() => assertNamespacePrefix('foo.')).toThrow();
    expect(() => assertNamespacePrefix('foo..bar')).toThrow();
    expect(() => assertNamespacePrefix('a')).toThrow();
    expect(() => assertNamespacePrefix('1foo')).toThrow();
    expect(() => assertNamespacePrefix('foo_bar')).toThrow();
  });

  it('throws on prefix exceeding max segment count', () => {
    const tooMany = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    ).join('.');
    expect(() => assertNamespacePrefix(tooMany)).toThrow();
  });
});

describe('assertLocalName', () => {
  it('does not throw for valid local names', () => {
    expect(() => assertLocalName('ab')).not.toThrow();
    expect(() => assertLocalName('foo-bar')).not.toThrow();
    expect(() => assertLocalName('a1')).not.toThrow();
  });

  it('throws on empty local name', () => {
    expect(() => assertLocalName('')).toThrow();
  });

  it('throws when local name contains a slash', () => {
    expect(() => assertLocalName('foo/bar')).toThrow();
    expect(() => assertLocalName('/foo')).toThrow();
    expect(() => assertLocalName('foo/')).toThrow();
  });

  it('throws when local name contains a dot', () => {
    expect(() => assertLocalName('foo.bar')).toThrow();
    expect(() => assertLocalName('.foo')).toThrow();
    expect(() => assertLocalName('foo.')).toThrow();
  });

  it('throws on shape violations', () => {
    expect(() => assertLocalName('a')).toThrow();
    expect(() => assertLocalName('Foo')).toThrow();
    expect(() => assertLocalName('foo_bar')).toThrow();
    expect(() => assertLocalName('-foo')).toThrow();
    expect(() => assertLocalName('foo-')).toThrow();
    expect(() => assertLocalName('foo--bar')).toThrow();
    expect(() => assertLocalName('1foo')).toThrow();
    expect(() => assertLocalName(' foo')).toThrow();
    expect(() => assertLocalName('foo ')).toThrow();
  });

  it('throws on oversized local names', () => {
    const tooLong = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1);
    expect(() => assertLocalName(tooLong)).toThrow();
  });
});

describe('namespacePrefixOf', () => {
  it('returns the namespace prefix for valid keys', () => {
    expect(namespacePrefixOf('todo/title')).toBe('todo');
    expect(namespacePrefixOf('chess.puzzle/id')).toBe('chess.puzzle');
    expect(namespacePrefixOf('a.b.c/d')).toBe('a.b.c');
  });

  it('returns the substring before the only slash even when shape is invalid', () => {
    expect(namespacePrefixOf('Foo/Bar')).toBe('Foo');
    expect(namespacePrefixOf('foo_bar/x')).toBe('foo_bar');
  });

  it('returns null for strings without a slash', () => {
    expect(namespacePrefixOf('')).toBeNull();
    expect(namespacePrefixOf('foo')).toBeNull();
    expect(namespacePrefixOf('todo.title')).toBeNull();
  });

  it('returns null for strings with multiple slashes', () => {
    expect(namespacePrefixOf('a/b/c')).toBeNull();
    expect(namespacePrefixOf('foo/bar/baz')).toBeNull();
    expect(namespacePrefixOf('//')).toBeNull();
    expect(namespacePrefixOf('foo//bar')).toBeNull();
  });

  it('returns null when slash is at index 0 (no prefix)', () => {
    expect(namespacePrefixOf('/foo')).toBeNull();
    expect(namespacePrefixOf('/')).toBeNull();
  });
});

describe('joinKeywordSegments', () => {
  it('joins one segment as-is', () => {
    expect(joinKeywordSegments('chess')).toBe('chess');
  });

  it('joins multiple segments with dots', () => {
    expect(joinKeywordSegments('chess', 'main-menu')).toBe('chess.main-menu');
    expect(joinKeywordSegments('a1', 'b2', 'c3')).toBe('a1.b2.c3');
  });

  it('preserves a precise template literal type via JoinDot', () => {
    const joined = joinKeywordSegments('chess', 'main-menu');
    const literalCheck: 'chess.main-menu' = joined;
    expect(literalCheck).toBe('chess.main-menu');
    const _explicit: JoinDot<['a', 'b']> = 'a.b';
    void _explicit;
  });

  it('throws when called with no segments', () => {
    expect(() => joinKeywordSegments()).toThrow();
  });

  it('throws on single-char segments', () => {
    expect(() => joinKeywordSegments('x')).toThrow();
    expect(() => joinKeywordSegments('ab', 'c')).toThrow();
    expect(() => joinKeywordSegments('a', 'bc')).toThrow();
  });

  it('throws on empty segments', () => {
    expect(() => joinKeywordSegments('')).toThrow();
    expect(() => joinKeywordSegments('foo', '')).toThrow();
  });

  it('throws on segments containing slashes or dots', () => {
    expect(() => joinKeywordSegments('foo/bar')).toThrow();
    expect(() => joinKeywordSegments('foo.bar')).toThrow();
    expect(() => joinKeywordSegments('foo', 'bar/baz')).toThrow();
    expect(() => joinKeywordSegments('foo', 'bar.baz')).toThrow();
  });

  it('throws on shape-invalid segments', () => {
    expect(() => joinKeywordSegments('Foo')).toThrow();
    expect(() => joinKeywordSegments('1foo')).toThrow();
    expect(() => joinKeywordSegments('foo_bar')).toThrow();
    expect(() => joinKeywordSegments('-foo')).toThrow();
    expect(() => joinKeywordSegments('foo-')).toThrow();
    expect(() => joinKeywordSegments('foo--bar')).toThrow();
    expect(() => joinKeywordSegments(' foo')).toThrow();
  });

  it('throws on oversized individual segments', () => {
    const tooLong = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH + 1);
    expect(() => joinKeywordSegments(tooLong)).toThrow();
    expect(() => joinKeywordSegments('foo', tooLong)).toThrow();
  });

  it('throws when joined prefix exceeds namespace segment cap', () => {
    const segments = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS + 1 },
      () => 'ab'
    );
    expect(() => joinKeywordSegments(...segments)).toThrow();
  });

  it('accepts joined prefix at the namespace segment cap', () => {
    const segments = Array.from(
      { length: KEYWORD_NAMESPACE_MAX_SEGMENTS },
      () => 'ab'
    );
    expect(() => joinKeywordSegments(...segments)).not.toThrow();
  });

  it('throws when joined prefix leaves no room for /<minimal-local>', () => {
    const seg = 'x'.repeat(KEYWORD_SEGMENT_MAX_LENGTH);
    const segCount = Math.ceil(
      (KEYWORD_MAX_LENGTH - KEYWORD_SEGMENT_MIN_LENGTH) /
        (KEYWORD_SEGMENT_MAX_LENGTH + 1)
    );
    if (segCount <= KEYWORD_NAMESPACE_MAX_SEGMENTS) {
      const segments = Array.from({ length: segCount }, () => seg);
      expect(() => joinKeywordSegments(...segments)).toThrow();
    }
  });
});

describe('assertKeywordRecord', () => {
  it('accepts an empty record', () => {
    expect(() => assertKeywordRecord({}, 'patch.attributes')).not.toThrow();
  });

  it('accepts a record whose keys are all namespaced keywords', () => {
    const r: Record<string, unknown> = {
      'todo/title': 'a',
      'patch/synced-at': 1,
      'chess.puzzle/id': 'p1',
    };
    expect(() => assertKeywordRecord(r, 'patch.attributes')).not.toThrow();
  });

  it('crashes on the first non-keyword key', () => {
    const r: Record<string, unknown> = { 'todo/title': 'a', badKey: 1 };
    expect(() => assertKeywordRecord(r, 'patch.attributes')).toThrow();
  });

  it('crashes on snake_case keys', () => {
    const r: Record<string, unknown> = { 'todo/title': 'a', snake_case_key: 1 };
    expect(() => assertKeywordRecord(r, 'patch.attributes')).toThrow();
  });

  it('crashes on camelCase keys', () => {
    const r: Record<string, unknown> = { camelCase: 1 };
    expect(() => assertKeywordRecord(r, 'attrs')).toThrow();
  });

  it('crashes on numeric-like keys', () => {
    const r: Record<string, unknown> = { '0': 1, '1': 2 };
    expect(() => assertKeywordRecord(r, 'attrs')).toThrow();
  });

  it('crashes on keys with multiple slashes', () => {
    const r: Record<string, unknown> = { 'a/b/c': 1 };
    expect(() => assertKeywordRecord(r, 'attrs')).toThrow();
  });

  it('crashes on keys with unicode characters', () => {
    const r: Record<string, unknown> = { 'todo/títle': 'a' };
    expect(() => assertKeywordRecord(r, 'attrs')).toThrow();
  });

  it('crashes on null', () => {
    expect(() =>
      assertKeywordRecord(null as unknown as Record<string, unknown>, 'x')
    ).toThrow();
  });

  it('crashes on undefined', () => {
    expect(() =>
      assertKeywordRecord(undefined as unknown as Record<string, unknown>, 'x')
    ).toThrow();
  });

  it('crashes on arrays (even empty)', () => {
    expect(() =>
      assertKeywordRecord([] as unknown as Record<string, unknown>, 'attrs')
    ).toThrow();
    expect(() =>
      assertKeywordRecord(
        ['todo/title'] as unknown as Record<string, unknown>,
        'attrs'
      )
    ).toThrow();
  });

  it('crashes on primitive non-objects', () => {
    expect(() =>
      assertKeywordRecord(42 as unknown as Record<string, unknown>, 'attrs')
    ).toThrow();
    expect(() =>
      assertKeywordRecord('s' as unknown as Record<string, unknown>, 'attrs')
    ).toThrow();
    expect(() =>
      assertKeywordRecord(true as unknown as Record<string, unknown>, 'attrs')
    ).toThrow();
  });

  it('only inspects own enumerable string keys', () => {
    const r: Record<string, unknown> = Object.create({ inheritedKey: 1 });
    r['todo/title'] = 'a';
    expect(() => assertKeywordRecord(r, 'attrs')).not.toThrow();
  });
});
