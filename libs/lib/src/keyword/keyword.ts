/**
 * Tiger Style: Clojure-style namespaced keywords (`prefix/local`, dot-separated prefix).
 * Shared by {@link @gamezilla/lib/attribute} and {@link @gamezilla/lib/message} so wire
 * rules cannot drift.
 */
import { Assert } from '@gamezilla/lib/assert';

const crash: Assert = Assert.crash();

declare const KeywordBrand: unique symbol;

/**
 * Namespaced keyword string `prefix/local` (validated by {@link isNamespacedKeyword}).
 * Branded so raw `string` cannot be assigned to a {@link Keyword} slot at compile time;
 * obtain a `Keyword` only via {@link asKeyword}, {@link assertKeyword}, {@link joinKeywordSegments},
 * or factories built on top of them ({@link createAttrNamespace}, {@link createMessageNamespace}).
 */
export type Keyword = string & { readonly [KeywordBrand]: 'keyword' };

/**
 * One kebab-case segment: lowercase letter first, then lowercase alphanumerics and
 * single hyphens between groups.
 */
export const CLOJURE_KEBAB_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Minimum UTF-16 code units per namespace segment and per local name. */
export const KEYWORD_SEGMENT_MIN_LENGTH = 2;

/** Maximum UTF-16 code units per namespace segment and per local name. */
export const KEYWORD_SEGMENT_MAX_LENGTH = 64;

/** Maximum dot-separated segments in the namespace prefix (before `/`). */
export const KEYWORD_NAMESPACE_MAX_SEGMENTS = 16;

/** Maximum UTF-16 code units for a full keyword `prefix/local`. */
export const KEYWORD_MAX_LENGTH = 256;

crash.ok(
  KEYWORD_SEGMENT_MIN_LENGTH <= KEYWORD_SEGMENT_MAX_LENGTH,
  'Tiger: KEYWORD_SEGMENT_MIN_LENGTH must not exceed KEYWORD_SEGMENT_MAX_LENGTH'
);
crash.ok(
  KEYWORD_NAMESPACE_MAX_SEGMENTS >= 1,
  'Tiger: KEYWORD_NAMESPACE_MAX_SEGMENTS must allow at least one namespace segment'
);
crash.ok(
  KEYWORD_MAX_LENGTH >=
    KEYWORD_SEGMENT_MIN_LENGTH + 1 + KEYWORD_SEGMENT_MIN_LENGTH,
  'Tiger: KEYWORD_MAX_LENGTH must fit a minimal valid key (prefix/local plus one slash)'
);

/**
 * Shape-only regex: `namespace/name`, kebab segments ≥2 chars each in pattern.
 * Does not enforce {@link KEYWORD_MAX_LENGTH} or segment count; use {@link isNamespacedKeyword}.
 */
export const CLOJURE_NAMESPACED_KEYWORD_REGEX =
  /^(?!.*\s)(?:[a-z][a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]+(?:-[a-z0-9]+)*)*)\/[a-z][a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Join namespace segments with `.` for template literal typing. */
export type JoinDot<T extends readonly string[]> = T extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[],
]
  ? Rest extends readonly []
    ? First
    : `${First}.${JoinDot<Rest>}`
  : string;

function isWireKebabSegment(seg: string): boolean {
  if (!CLOJURE_KEBAB_SEGMENT.test(seg)) return false;
  if (seg.length < KEYWORD_SEGMENT_MIN_LENGTH) return false;
  if (seg.length > KEYWORD_SEGMENT_MAX_LENGTH) return false;
  return true;
}

function isWireNamespacePrefix(prefix: string): boolean {
  if (prefix.startsWith('.')) return false;
  if (prefix.endsWith('.')) return false;
  if (prefix.includes('..')) return false;
  const segments = prefix.split('.');
  if (segments.length > KEYWORD_NAMESPACE_MAX_SEGMENTS) return false;
  for (const seg of segments) {
    if (seg.length === 0) return false;
    if (!isWireKebabSegment(seg)) return false;
  }
  return true;
}

/** True when `seg` matches wire rules (kebab + bounded length). */
export function isKebabSegment(seg: unknown): seg is string {
  return typeof seg === 'string' && isWireKebabSegment(seg);
}

/**
 * True when `prefix` is a valid dot-separated kebab namespace (before `/`),
 * with strict per-segment length ({@link KEYWORD_SEGMENT_MIN_LENGTH}–{@link KEYWORD_SEGMENT_MAX_LENGTH}).
 */
export function isNamespacePrefix(prefix: unknown): prefix is string {
  if (typeof prefix !== 'string') return false;
  if (prefix.length === 0) return false;
  return isWireNamespacePrefix(prefix);
}

/** True when `name` is valid local part after `/`. */
export function isLocalName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  return isWireKebabSegment(name);
}

function isAsciiKeywordCharset(key: string): boolean {
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    if (c >= 97 && c <= 122) continue;
    if (c >= 48 && c <= 57) continue;
    if (c === 46) continue;
    if (c === 45) continue;
    if (c === 47) continue;
    return false;
  }
  return true;
}

/**
 * True when `key` is a valid namespaced keyword for wire / PatchDB / message types:
 * exactly one `/`, ASCII subset, bounded lengths, strict kebab segments.
 */
export function isNamespacedKeyword(key: unknown): key is Keyword {
  if (typeof key !== 'string') return false;
  if (key.length === 0) return false;
  if (key.length > KEYWORD_MAX_LENGTH) return false;
  if (!isAsciiKeywordCharset(key)) return false;
  const slash = key.indexOf('/');
  if (slash <= 0) return false;
  if (slash !== key.lastIndexOf('/')) return false;
  const ns = key.slice(0, slash);
  const local = key.slice(slash + 1);
  if (local.length === 0) return false;
  if (!isWireNamespacePrefix(ns)) return false;
  if (!isWireKebabSegment(local)) return false;
  return true;
}

/**
 * Assert runtime shape then return the same string typed as a {@link Keyword}.
 * Preserves a literal-string input type so call sites like
 * `asKeyword('room.wire.s2c/welcome')` discriminate against literal-keyed unions.
 */
export function asKeyword<const S extends string>(key: S): S & Keyword {
  crash.ok(
    isNamespacedKeyword(key),
    'Tiger: asKeyword requires a valid namespaced keyword',
    { key }
  );
  return key as S & Keyword;
}

/** Alias for {@link asKeyword}, framed as an assertion helper for ergonomic call sites. */
export function assertKeyword<const S extends string>(key: S): S & Keyword {
  return asKeyword(key);
}

/**
 * Tiger guard for record-shaped values: every own enumerable key must be a
 * valid namespaced keyword. Crashes on the first violation; useful at wire /
 * persistence boundaries (patch attributes, room state, etc.).
 */
export function assertKeywordRecord(
  record: Record<string, unknown>,
  label: string
): asserts record is Record<Keyword, unknown> {
  crash.ok(
    record !== null && typeof record === 'object' && !Array.isArray(record),
    `${label} must be a plain record`
  );
  for (const key of Object.keys(record)) {
    crash.ok(
      isNamespacedKeyword(key),
      `${label} contains a non-keyword key: must be a Clojure-style namespaced keyword`,
      { key }
    );
  }
}

/** Dot-separated namespace prefix before `/`, or null if not exactly one slash. */
export function namespacePrefixOf(key: string): string | null {
  const slash = key.indexOf('/');
  if (slash <= 0) return null;
  if (slash !== key.lastIndexOf('/')) return null;
  return key.slice(0, slash);
}

export function assertNamespacePrefix(value: string): void {
  crash.ok(
    isWireNamespacePrefix(value),
    `namespace prefix must be 1–${KEYWORD_NAMESPACE_MAX_SEGMENTS} dot-separated kebab segments, each ${KEYWORD_SEGMENT_MIN_LENGTH}–${KEYWORD_SEGMENT_MAX_LENGTH} chars (lowercase ASCII, single hyphens between alnum groups); no empty segments`
  );
}

export function assertLocalName(value: string): void {
  crash.nonEmptyString(value, 'keyword local name must be non-empty');
  crash.ok(!value.includes('/'), 'keyword local name must not contain /');
  crash.ok(!value.includes('.'), 'keyword local name must not contain .');
  crash.ok(
    isLocalName(value),
    `keyword local name must be kebab-case ASCII, ${KEYWORD_SEGMENT_MIN_LENGTH}–${KEYWORD_SEGMENT_MAX_LENGTH} chars (lowercase letter first, then alnum/hyphens; no leading/trailing/consecutive hyphens)`
  );
}

export function assertNamespacedKeyword(
  fullKey: string
): asserts fullKey is Keyword {
  crash.ok(
    isNamespacedKeyword(fullKey),
    `keyword must be ASCII namespaced kebab-case, at most ${KEYWORD_MAX_LENGTH} chars, one '/', strict segment lengths`,
    { fullKey }
  );
}

/**
 * Joins validated namespace segments with `.` into a prefix (no trailing slash).
 * Result is **not** a {@link Keyword} (no `/`); use {@link asKeyword} after appending a local name.
 */
export function joinKeywordSegments<const Segments extends readonly string[]>(
  ...segments: Segments
): JoinDot<Segments> {
  crash.ok(
    segments.length > 0,
    'joinKeywordSegments requires at least one segment'
  );
  for (const seg of segments) {
    crash.nonEmptyString(seg, 'each keyword segment must be non-empty');
    assertLocalName(seg);
  }
  const prefix = segments.join('.') as JoinDot<Segments>;
  assertNamespacePrefix(prefix);
  crash.ok(
    prefix.length <= KEYWORD_MAX_LENGTH - 1 - KEYWORD_SEGMENT_MIN_LENGTH,
    'Tiger: joined prefix leaves no room for slash and a minimal local segment'
  );
  return prefix;
}
