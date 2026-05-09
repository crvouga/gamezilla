/**
 * Tiger Style (see repo `LLM.md`): hard bounds on wire strings, split predicates so each
 * failure mode is obvious, assert relationships between compile-time limits, and crash on
 * programmer mistakes at construction time — never accept silently malformed attribute keys.
 */
import { Assert } from '@gamezilla/lib/assert';

const crash: Assert = Assert.crash();

/**
 * One kebab-case Clojure-style symbol segment: lowercase letter first, then
 * lowercase alphanumerics and single hyphens between groups (no leading/trailing
 * hyphen, no consecutive hyphens). No uppercase, no underscores, no dots inside
 * a segment — dots only separate namespace segments before `/`.
 *
 * Message type segments may be a single character; **persisted attribute keys**
 * additionally require {@link ATTRIBUTE_SEGMENT_MIN_LENGTH}–{@link ATTRIBUTE_SEGMENT_MAX_LENGTH}
 * per segment (enforced by {@link isClojureNamespacedKey} and {@link createAttrNamespace}).
 */
export const CLOJURE_KEBAB_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Minimum UTF-16 code units per namespace segment and per local name (attributes only). */
export const ATTRIBUTE_SEGMENT_MIN_LENGTH = 2;

/** Maximum UTF-16 code units per namespace segment and per local name (attributes only). */
export const ATTRIBUTE_SEGMENT_MAX_LENGTH = 64;

/** Maximum dot-separated segments allowed in the namespace prefix (before `/`). */
export const ATTRIBUTE_NAMESPACE_MAX_SEGMENTS = 16;

/** Maximum UTF-16 code units for a full attribute key `prefix/local`. */
export const ATTRIBUTE_KEY_MAX_LENGTH = 256;

crash.ok(
  ATTRIBUTE_SEGMENT_MIN_LENGTH <= ATTRIBUTE_SEGMENT_MAX_LENGTH,
  'Tiger: ATTRIBUTE_SEGMENT_MIN_LENGTH must not exceed ATTRIBUTE_SEGMENT_MAX_LENGTH'
);
crash.ok(
  ATTRIBUTE_NAMESPACE_MAX_SEGMENTS >= 1,
  'Tiger: ATTRIBUTE_NAMESPACE_MAX_SEGMENTS must allow at least one namespace segment'
);
crash.ok(
  ATTRIBUTE_KEY_MAX_LENGTH >=
    ATTRIBUTE_SEGMENT_MIN_LENGTH + 1 + ATTRIBUTE_SEGMENT_MIN_LENGTH,
  'Tiger: ATTRIBUTE_KEY_MAX_LENGTH must fit a minimal valid key (prefix/local plus one slash)'
);

/**
 * Qualified attribute key shape: `namespace/name` with exactly one `/`.
 *
 * Matches segment **shape** (kebab, min two chars per segment). Does **not**
 * enforce {@link ATTRIBUTE_KEY_MAX_LENGTH} or {@link ATTRIBUTE_NAMESPACE_MAX_SEGMENTS};
 * use {@link isClojureNamespacedKey} at persistence / wire boundaries.
 *
 * - **Namespace** (before `/`): one or more kebab pieces joined by `.`
 *   (e.g. `patch`, `chat.message`, `chess.main-menu`).
 * - **Name** (after `/`): a single kebab segment (no `/`, no `.`).
 */
export const CLOJURE_NAMESPACED_ATTRIBUTE_REGEX =
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

function isAttributeWireKebabSegment(seg: string): boolean {
  if (!CLOJURE_KEBAB_SEGMENT.test(seg)) return false;
  if (seg.length < ATTRIBUTE_SEGMENT_MIN_LENGTH) return false;
  if (seg.length > ATTRIBUTE_SEGMENT_MAX_LENGTH) return false;
  return true;
}

function isAttributeWireNamespacePrefix(prefix: string): boolean {
  if (prefix.startsWith('.')) return false;
  if (prefix.endsWith('.')) return false;
  if (prefix.includes('..')) return false;
  const segments = prefix.split('.');
  if (segments.length > ATTRIBUTE_NAMESPACE_MAX_SEGMENTS) return false;
  for (const seg of segments) {
    if (seg.length === 0) return false;
    if (!isAttributeWireKebabSegment(seg)) return false;
  }
  return true;
}

/**
 * True when `prefix` is a valid dot-separated kebab namespace (before `/`).
 *
 * Lenient per-segment length (≥1 character) so message type prefixes stay compatible
 * with message namespaces. For persisted attributes, use
 * {@link isClojureNamespacedKey} on the full key instead.
 */
export function isClojureNamespacePrefix(prefix: unknown): prefix is string {
  if (typeof prefix !== 'string') return false;
  if (prefix.length === 0) return false;
  if (prefix.startsWith('.')) return false;
  if (prefix.endsWith('.')) return false;
  if (prefix.includes('..')) return false;
  const segments = prefix.split('.');
  for (const seg of segments) {
    if (seg.length === 0) return false;
    if (!CLOJURE_KEBAB_SEGMENT.test(seg)) return false;
  }
  return true;
}

/**
 * True when `name` is a valid **attribute** local name (the part after `/`): kebab
 * shape with {@link ATTRIBUTE_SEGMENT_MIN_LENGTH}–{@link ATTRIBUTE_SEGMENT_MAX_LENGTH}
 * UTF-16 code units, ASCII letters/digits/hyphens only.
 */
export function isClojureLocalName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  if (!isAttributeWireKebabSegment(name)) return false;
  return true;
}

/** True when every code unit is allowed in a persisted attribute key (ASCII subset). */
function isAsciiAttributeKeyCharset(key: string): boolean {
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
 * True when `key` is a valid namespaced attribute key for wire / PatchDB storage:
 * exactly one `/`, strict ASCII charset, bounded lengths, kebab segments
 * ({@link ATTRIBUTE_SEGMENT_MIN_LENGTH}–{@link ATTRIBUTE_SEGMENT_MAX_LENGTH} each),
 * and at most {@link ATTRIBUTE_NAMESPACE_MAX_SEGMENTS} dot-separated namespace segments.
 */
export function isClojureNamespacedKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  if (key.length === 0) return false;
  if (key.length > ATTRIBUTE_KEY_MAX_LENGTH) return false;
  if (!isAsciiAttributeKeyCharset(key)) return false;
  const slash = key.indexOf('/');
  if (slash <= 0) return false;
  if (slash !== key.lastIndexOf('/')) return false;
  const ns = key.slice(0, slash);
  const local = key.slice(slash + 1);
  if (local.length === 0) return false;
  if (!isAttributeWireNamespacePrefix(ns)) return false;
  if (!isAttributeWireKebabSegment(local)) return false;
  return true;
}

/** Flat state bag keyed by full attribute keys (`prefix/name`). */
export type AttributeState = Record<string, unknown>;

/**
 * Parse and validate a raw stored value into `T`. May throw if invalid.
 */
export type AttributeParser<T> = (value: unknown) => T;

export interface AttributeTag<T = unknown, K extends string = string> {
  readonly key: K;
  readonly parse: AttributeParser<T>;
  /**
   * Builds a single-key patch `{ [key]: parse(value) }` for PatchDB writes.
   * Use {@link AttributeTag.parse} to validate raw input without wrapping.
   */
  (value: unknown): { readonly [P in K]: T };
  /** Reads `state[key]` then parses (missing key yields `undefined`). */
  from(state: AttributeState): T;
}

export interface AttributeNamespace<Prefix extends string = string> {
  readonly prefix: Prefix;
  /**
   * @param name - Short attribute name (becomes `{prefix}/{name}`).
   * @param parse - Parses raw stored values; throw on invalid input.
   */
  <const Name extends string, T>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, `${Prefix}/${Name}`>;
}

function assertValidNamespacePrefix(value: string): void {
  crash.ok(
    isAttributeWireNamespacePrefix(value),
    `namespace prefix must be 1–${ATTRIBUTE_NAMESPACE_MAX_SEGMENTS} dot-separated kebab segments, each ${ATTRIBUTE_SEGMENT_MIN_LENGTH}–${ATTRIBUTE_SEGMENT_MAX_LENGTH} chars (lowercase ASCII, single hyphens between alnum groups); no empty segments`
  );
}

function assertValidAttributeLocalName(value: string): void {
  crash.nonEmptyString(value, 'attribute name must be non-empty');
  crash.ok(!value.includes('/'), 'attribute name must not contain /');
  crash.ok(!value.includes('.'), 'attribute name must not contain .');
  crash.ok(
    isClojureLocalName(value),
    `attribute name must be kebab-case ASCII, ${ATTRIBUTE_SEGMENT_MIN_LENGTH}–${ATTRIBUTE_SEGMENT_MAX_LENGTH} chars (lowercase letter first, then alnum/hyphens; no leading/trailing/consecutive hyphens)`
  );
}

function assertValidFullKey(fullKey: string): void {
  crash.ok(
    isClojureNamespacedKey(fullKey),
    `attribute key must be ASCII namespaced kebab-case, at most ${ATTRIBUTE_KEY_MAX_LENGTH} chars, one '/', strict segment lengths`
  );
}

function createAttributeTag<T, K extends string>(
  fullKey: K,
  parse: AttributeParser<T>
): AttributeTag<T, K> {
  crash.nonEmptyString(fullKey, 'Tiger: attribute tag key must be non-empty');
  crash.ok(
    typeof parse === 'function',
    'Tiger: attribute parser must be a function'
  );
  crash.ok(
    isClojureNamespacedKey(fullKey),
    'Tiger: attribute tag key must pass wire validation'
  );

  function attr(value: unknown): { readonly [P in K]: T } {
    return { [fullKey]: parse(value) } as { readonly [P in K]: T };
  }
  Object.defineProperty(attr, 'key', {
    value: fullKey,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(attr, 'parse', {
    value: parse,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  attr.from = (state: AttributeState): T => parse(state[fullKey]);
  return attr as AttributeTag<T, K>;
}

/**
 * Creates a namespace for attribute keys: `{prefix}/{name}` where `prefix` is
 * `segment0.segment1...` from the given kebab-case segments.
 *
 * @example
 * ```ts
 * const gamesNs = createAttrNamespace('games');
 * const Selected = gamesNs('selected', (v) => {
 *   if (v === 'chess' || v === 'connect-four' || v === null) return v;
 *   throw new Error('invalid');
 * });
 *
 * const chessNs = createAttrNamespace('chess', 'main-menu');
 * const Fen = chessNs('fen', (v) => (typeof v === 'string' ? v : ''));
 * ```
 */
export function createAttrNamespace<const Segments extends readonly string[]>(
  ...segments: Segments
): AttributeNamespace<JoinDot<Segments>> {
  crash.ok(
    segments.length > 0,
    'createAttrNamespace requires at least one namespace segment'
  );
  for (const seg of segments) {
    crash.nonEmptyString(
      seg,
      'each namespace segment must be a non-empty kebab-case string'
    );
    crash.ok(
      isClojureLocalName(seg),
      `each namespace segment must be kebab-case ASCII, ${ATTRIBUTE_SEGMENT_MIN_LENGTH}–${ATTRIBUTE_SEGMENT_MAX_LENGTH} chars (no dots/slashes in a segment; no spaces, uppercase, or underscores)`,
      { seg }
    );
  }
  const prefix = segments.join('.') as JoinDot<Segments>;
  assertValidNamespacePrefix(prefix);
  crash.ok(
    prefix.length <=
      ATTRIBUTE_KEY_MAX_LENGTH - 1 - ATTRIBUTE_SEGMENT_MIN_LENGTH,
    'Tiger: namespace prefix leaves no room for slash and a minimal local segment'
  );

  function bind<const Name extends string, T>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, `${JoinDot<Segments>}/${Name}`> {
    assertValidAttributeLocalName(name);
    const fullKey = `${prefix}/${name}` as `${JoinDot<Segments>}/${Name}`;
    assertValidFullKey(fullKey);
    return createAttributeTag(fullKey, parse);
  }

  Object.defineProperty(bind, 'prefix', {
    value: prefix,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return bind as AttributeNamespace<JoinDot<Segments>>;
}
