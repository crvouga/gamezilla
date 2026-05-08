import { Assert } from '@gamezilla/lib/assert';

const crash: Assert = Assert.crash();

/**
 * One kebab-case Clojure-style symbol segment: lowercase letter first, then
 * lowercase alphanumerics and single hyphens between groups (no leading/trailing
 * hyphen, no consecutive hyphens). No uppercase, no underscores, no dots inside
 * a segment — dots only separate namespace segments before `/`.
 */
export const CLOJURE_KEBAB_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Strict qualified attribute key: `namespace/name` with exactly one `/`.
 *
 * - **Namespace** (before `/`): one or more {@link CLOJURE_KEBAB_SEGMENT} pieces
 *   joined by `.` (e.g. `patch`, `chat.message`, `chess.main-menu`).
 * - **Name** (after `/`): a single {@link CLOJURE_KEBAB_SEGMENT} (no `/`, no `.`).
 */
export const CLOJURE_NAMESPACED_ATTRIBUTE_REGEX =
  /^(?!.*\s)(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*)\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Join namespace segments with `.` for template literal typing. */
export type JoinDot<T extends readonly string[]> = T extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[],
]
  ? Rest extends readonly []
    ? First
    : `${First}.${JoinDot<Rest>}`
  : string;

/** True when `prefix` is a valid dot-separated kebab namespace (before `/`). */
export function isClojureNamespacePrefix(prefix: unknown): prefix is string {
  if (typeof prefix !== 'string' || prefix.length === 0) return false;
  if (prefix.startsWith('.') || prefix.endsWith('.')) return false;
  if (prefix.includes('..')) return false;
  const segments = prefix.split('.');
  for (const seg of segments) {
    if (seg.length === 0 || !CLOJURE_KEBAB_SEGMENT.test(seg)) return false;
  }
  return true;
}

/** True when `name` is a valid local attribute name (the part after `/`). */
export function isClojureLocalName(name: unknown): name is string {
  return typeof name === 'string' && CLOJURE_KEBAB_SEGMENT.test(name);
}

/** Returns true when `key` is a valid Clojure-style namespaced attribute key. */
export function isClojureNamespacedKey(key: unknown): key is string {
  if (typeof key !== 'string' || /\s/.test(key)) return false;
  const slash = key.indexOf('/');
  if (slash <= 0 || slash !== key.lastIndexOf('/')) return false;
  const ns = key.slice(0, slash);
  const local = key.slice(slash + 1);
  if (local.length === 0) return false;
  return isClojureNamespacePrefix(ns) && isClojureLocalName(local);
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
    isClojureNamespacePrefix(value),
    'namespace prefix must be one or more dot-separated kebab-case segments (e.g. chess.puzzle, patch); no empty segments; no uppercase, underscores, or spaces'
  );
}

function assertValidAttributeLocalName(value: string): void {
  crash.nonEmptyString(value, 'attribute name must be non-empty');
  crash.ok(
    !value.includes('/') && !value.includes('.'),
    'attribute name must not contain / or .'
  );
  crash.ok(
    isClojureLocalName(value),
    'attribute name must be kebab-case Clojure segment (lowercase letter, then alnum/hyphens; no leading/trailing/consecutive hyphens)'
  );
}

function assertValidFullKey(fullKey: string): void {
  crash.ok(
    isClojureNamespacedKey(fullKey),
    'attribute key must be a valid Clojure-style namespaced kebab-case key'
  );
}

function createAttributeTag<T, K extends string>(
  fullKey: K,
  parse: AttributeParser<T>
): AttributeTag<T, K> {
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
      `each namespace segment must be kebab-case (lowercase, hyphens only; no dots or slashes in a segment) and not contain spaces or uppercase letters or underscores or leading/trailing hyphens`,
      { seg }
    );
  }
  const prefix = segments.join('.') as JoinDot<Segments>;
  assertValidNamespacePrefix(prefix);

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
