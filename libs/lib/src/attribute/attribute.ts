import { Assert } from '@gamezilla/lib/assert';

const validation: Assert = Assert.validation();

/** Flat state bag keyed by full attribute keys (`prefix/name`). */
export type AttributeState = Record<string, unknown>;

/**
 * Parse and validate a raw stored value into `T`. May throw if invalid.
 */
export type AttributeParser<T> = (value: unknown) => T;

export interface AttributeTag<T = unknown> {
  readonly key: string;
  readonly parse: AttributeParser<T>;
  /** Parses `value`; throws if invalid. */
  (value: unknown): T;
  /** Reads `state[key]` then parses (missing key yields `undefined`). */
  from(state: AttributeState): T;
}

export interface AttributeNamespace {
  readonly prefix: string;
  /**
   * @param name - Short attribute name (becomes `{prefix}/{name}`).
   * @param parse - Parses raw stored values; throw on invalid input.
   */
  <T>(name: string, parse: AttributeParser<T>): AttributeTag<T>;
}

function assertValidPrefixOrName(label: string, value: string): void {
  validation.nonEmptyString(value, `${label} must be non-empty`);
  validation.ok(!value.includes('/'), `${label} must not contain '/'`);
}

function createAttributeTag<T>(
  fullKey: string,
  parse: AttributeParser<T>
): AttributeTag<T> {
  function attr(value: unknown): T {
    return parse(value);
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
  return attr as AttributeTag<T>;
}

/**
 * Creates a namespace for attribute keys: `{prefix}/{name}`.
 *
 * @example
 * ```ts
 * const createAttr = createAttrNamespace('games');
 * const SelectedAttr = createAttr('selected', (v) => {
 *   if (v === 'chess' || v === 'connect-four' || v === null) return v;
 *   throw new Error('invalid');
 * });
 * const x = SelectedAttr.from(someState);
 * ```
 */
export function createAttrNamespace(prefix: string): AttributeNamespace {
  assertValidPrefixOrName('namespace prefix', prefix);

  function bind<T>(name: string, parse: AttributeParser<T>): AttributeTag<T> {
    assertValidPrefixOrName('attribute name', name);
    const fullKey = `${prefix}/${name}`;
    return createAttributeTag(fullKey, parse);
  }

  Object.defineProperty(bind, 'prefix', {
    value: prefix,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return bind as AttributeNamespace;
}
