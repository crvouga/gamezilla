import { Assert } from '@gamezilla/lib/assert';

const validation: Assert = Assert.validation();

/**
 * Same rule as PatchDB {@link isValidAttribute}: Clojure-style namespaced key,
 * no whitespace; each segment is `[a-zA-Z_][a-zA-Z0-9_.]*`.
 */
export const PATCH_DB_NAMESPACED_ATTRIBUTE_REGEX =
  /^(?!.*\s)[a-zA-Z_][a-zA-Z0-9_.]*\/[a-zA-Z_][a-zA-Z0-9_.]*$/;

const PATCH_DB_SEGMENT_REGEX = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

/** Returns true when `key` is a valid PatchDB attribute key string. */
export function isValidPatchDbAttributeKey(key: unknown): key is string {
  return (
    typeof key === 'string' && PATCH_DB_NAMESPACED_ATTRIBUTE_REGEX.test(key)
  );
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

function assertValidSegment(label: string, value: string): void {
  validation.nonEmptyString(value, `${label} must be non-empty`);
  validation.ok(!value.includes('/'), `${label} must not contain '/'`);
  validation.ok(
    PATCH_DB_SEGMENT_REGEX.test(value),
    `${label} must match PatchDB segment rules (letter or underscore, then alnum / _ / .)`
  );
}

function assertValidFullKey(fullKey: string): void {
  validation.ok(
    isValidPatchDbAttributeKey(fullKey),
    `attribute key must be a valid PatchDB namespaced key`
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
 * Creates a namespace for attribute keys: `{prefix}/{name}`.
 *
 * @example
 * ```ts
 * import { mergePlain } from '@gamezilla/lib/merge-plain';
 * const createAttr = createAttrNamespace('games');
 * const Selected = createAttr('selected', (v) => {
 *   if (v === 'chess' || v === 'connect-four' || v === null) return v;
 *   throw new Error('invalid');
 * });
 * const patch = mergePlain(Selected('chess'), Selected(null));
 * const x = Selected.from(someState);
 * ```
 */
export function createAttrNamespace<const Prefix extends string>(
  prefix: Prefix
): AttributeNamespace<Prefix> {
  assertValidSegment('namespace prefix', prefix);

  function bind<const Name extends string, T>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, `${Prefix}/${Name}`> {
    assertValidSegment('attribute name', name);
    const fullKey = `${prefix}/${name}` as `${Prefix}/${Name}`;
    assertValidFullKey(fullKey);
    return createAttributeTag(fullKey, parse);
  }

  Object.defineProperty(bind, 'prefix', {
    value: prefix,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return bind as AttributeNamespace<Prefix>;
}
