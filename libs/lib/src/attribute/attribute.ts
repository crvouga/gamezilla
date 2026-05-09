/**
 * Tiger Style (see repo `LLM.md`): attribute tags for PatchDB — keys validated via
 * {@link @gamezilla/lib/keyword}; never accept silently malformed attribute keys.
 */
import { Assert } from '@gamezilla/lib/assert';
import {
  assertLocalName,
  assertNamespacedKeyword,
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_KEYWORD_REGEX,
  isLocalName,
  isNamespacedKeyword,
  isNamespacePrefix,
  joinKeywordSegments,
  KEYWORD_MAX_LENGTH,
  KEYWORD_NAMESPACE_MAX_SEGMENTS,
  KEYWORD_SEGMENT_MAX_LENGTH,
  KEYWORD_SEGMENT_MIN_LENGTH,
  namespacePrefixOf,
  type JoinDot,
  type Keyword,
} from '../keyword/keyword';

const crash: Assert = Assert.crash();

/** @deprecated Use {@link KEYWORD_SEGMENT_MIN_LENGTH} from `@gamezilla/lib/keyword`. */
export const ATTRIBUTE_SEGMENT_MIN_LENGTH = KEYWORD_SEGMENT_MIN_LENGTH;

/** @deprecated Use {@link KEYWORD_SEGMENT_MAX_LENGTH} from `@gamezilla/lib/keyword`. */
export const ATTRIBUTE_SEGMENT_MAX_LENGTH = KEYWORD_SEGMENT_MAX_LENGTH;

/** @deprecated Use {@link KEYWORD_NAMESPACE_MAX_SEGMENTS} from `@gamezilla/lib/keyword`. */
export const ATTRIBUTE_NAMESPACE_MAX_SEGMENTS = KEYWORD_NAMESPACE_MAX_SEGMENTS;

/** @deprecated Use {@link KEYWORD_MAX_LENGTH} from `@gamezilla/lib/keyword`. */
export const ATTRIBUTE_KEY_MAX_LENGTH = KEYWORD_MAX_LENGTH;

export { CLOJURE_KEBAB_SEGMENT };

/** @deprecated Use {@link CLOJURE_NAMESPACED_KEYWORD_REGEX} from `@gamezilla/lib/keyword`. */
export const CLOJURE_NAMESPACED_ATTRIBUTE_REGEX =
  CLOJURE_NAMESPACED_KEYWORD_REGEX;

export type { JoinDot, Keyword };

/**
 * True when `prefix` is a valid dot-separated kebab namespace (before `/`),
 * with strict per-segment length (same rules as PatchDB attributes and message types).
 */
export function isClojureNamespacePrefix(prefix: unknown): prefix is string {
  return isNamespacePrefix(prefix);
}

/**
 * True when `name` is a valid local name (after `/`): kebab, bounded length, ASCII.
 */
export function isClojureLocalName(name: unknown): name is string {
  return isLocalName(name);
}

/**
 * True when `key` is a valid namespaced attribute key for wire / PatchDB storage.
 */
export function isClojureNamespacedKey(key: unknown): key is Keyword {
  return isNamespacedKeyword(key);
}

/** Flat state bag keyed by full attribute keys (`prefix/name`). */
export type AttributeState = Record<string, unknown>;

/**
 * Parse and validate a raw stored value into `T`. May throw if invalid.
 */
export type AttributeParser<T> = (value: unknown) => T;

export interface AttributeTag<T = unknown, K extends string = string> {
  readonly key: K & Keyword;
  readonly parse: AttributeParser<T>;
  /**
   * Builds a single-key patch `{ [key]: parse(value) }` for PatchDB writes.
   * Use {@link AttributeTag.parse} to validate raw input without wrapping.
   */
  (value: unknown): { readonly [P in K & Keyword]: T };
  /** Reads `state[key]` then parses (missing key yields `undefined`). */
  from(state: AttributeState): T;
}

export interface AttributeNamespace<Prefix extends string = string> {
  readonly prefix: Prefix;
  /** True when `key` is a full keyword whose namespace prefix equals this namespace's `prefix`. */
  ownsKey(key: string): boolean;
  /**
   * @param name - Short attribute name (becomes `{prefix}/{name}`).
   * @param parse - Parses raw stored values; throw on invalid input.
   */
  <const Name extends string, T>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, `${Prefix}/${Name}`>;
}

function assertValidAttributeLocalName(value: string): void {
  assertLocalName(value);
}

function assertValidFullKey(fullKey: string): void {
  assertNamespacedKeyword(fullKey);
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
  assertNamespacedKeyword(fullKey);

  const brandedKey = fullKey as K & Keyword;

  function attr(value: unknown): { readonly [P in K & Keyword]: T } {
    return { [fullKey]: parse(value) } as { readonly [P in K & Keyword]: T };
  }
  Object.defineProperty(attr, 'key', {
    value: brandedKey,
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
 */
export function createAttrNamespace<const Segments extends readonly string[]>(
  ...segments: Segments
): AttributeNamespace<JoinDot<Segments>> {
  crash.ok(
    segments.length > 0,
    'createAttrNamespace requires at least one namespace segment'
  );
  const prefix = joinKeywordSegments(...segments) as JoinDot<Segments>;

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

  bind.ownsKey = (key: string): boolean => {
    const p = namespacePrefixOf(key);
    return p !== null && p === prefix;
  };

  return bind as AttributeNamespace<JoinDot<Segments>>;
}
