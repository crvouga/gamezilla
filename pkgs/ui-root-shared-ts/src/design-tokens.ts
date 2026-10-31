/**
 * Readers for the design-token document (W3C Design Tokens format:
 * `$value` / `$type` / `$description`, groups, and `{group.token}` aliases).
 * The source is this package's `src/design-tokens.json`.
 * `tokens.css` and `token-names.ts` are generated from it.
 *
 * Every TypeScript constant (`spacing`, `COLOR_PALETTE`, `duration`, …) is
 * derived through these functions, so a value exists once: in that document.
 *
 * A module imports only the top-level groups it reads
 * (`import { space } from './design-tokens.json'`) and hands them to
 * {@link readGroup} as the alias root, so a bundle carries the groups it uses.
 */

/** A group or a token: `$`-prefixed keys are metadata, the rest are children. */
export type TokenTree = Readonly<Record<string, unknown>>;

/** Names of a group's tokens (or sub-groups): every key that is not metadata. */
export type TokenName<G> = Exclude<keyof G, `$${string}`> & string;

const ALIAS = /^\{([^{}]+)\}$/;
/** Longest alias chain followed before a reference is declared circular. */
const ALIAS_DEPTH_MAX = 16;

export function isTokenTree(value: unknown): value is TokenTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `space.scale.2` for the alias `{space.scale.2}`; undefined for a value. */
export function aliasPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return ALIAS.exec(value)?.[1];
}

function nodeAt(root: TokenTree, path: string): unknown {
  let node: unknown = root;
  for (const segment of path.split('.')) {
    if (!isTokenTree(node)) return undefined;
    node = node[segment];
  }
  return node;
}

/**
 * `value` with every alias followed to the token it names. Throws on a
 * reference that leaves `root`, names a group, or never ends.
 */
export function resolveTokenValue(root: TokenTree, value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < ALIAS_DEPTH_MAX; depth++) {
    const path = aliasPath(current);
    if (path === undefined) return current;
    const target = nodeAt(root, path);
    if (!isTokenTree(target) || !('$value' in target)) {
      throw new Error(`design token alias {${path}} names no token`);
    }
    current = target['$value'];
  }
  throw new Error(`design token alias ${String(value)} is circular`);
}

/** Token names of `group` in source order. */
export function tokenNames<G extends object>(group: G): TokenName<G>[] {
  return Object.keys(group).filter(
    (key) => !key.startsWith('$')
  ) as TokenName<G>[];
}

/**
 * Every token of `group` read through `read`, aliases resolved against
 * `root` (the top-level groups an alias in this group may name).
 */
export function readGroup<G extends object, V>(
  root: TokenTree,
  group: G,
  read: (value: unknown) => V
): Readonly<Record<TokenName<G>, V>> {
  const tokens = group as TokenTree;
  const out: Record<string, V> = {};
  for (const name of tokenNames(group)) {
    const token = tokens[name];
    if (!isTokenTree(token) || !('$value' in token)) {
      throw new Error(`design token ${name} has no $value`);
    }
    out[name] = read(resolveTokenValue(root, token['$value']));
  }
  return out as Readonly<Record<TokenName<G>, V>>;
}

/** Last path segment of each token's alias: the token it points at. */
export function readAliasTargets<G extends object>(
  group: G
): Readonly<Record<TokenName<G>, string>> {
  const tokens = group as TokenTree;
  const out: Record<string, string> = {};
  for (const name of tokenNames(group)) {
    const token = tokens[name];
    const path = isTokenTree(token) ? aliasPath(token['$value']) : undefined;
    const target = path?.split('.').at(-1);
    if (target === undefined) {
      throw new Error(`design token ${name} is not an alias`);
    }
    out[name] = target;
  }
  return out as Readonly<Record<TokenName<G>, string>>;
}

function quantity(value: unknown, unit: string): number {
  if (
    isTokenTree(value) &&
    typeof value['value'] === 'number' &&
    value['unit'] === unit
  ) {
    return value['value'];
  }
  throw new Error(`expected a ${unit} quantity, got ${JSON.stringify(value)}`);
}

/** A `dimension` in CSS px. */
export function readPx(value: unknown): number {
  return quantity(value, 'px');
}

/** A `duration` in milliseconds. */
export function readMs(value: unknown): number {
  return quantity(value, 'ms');
}

/** A `number` or numeric `fontWeight`. */
export function readNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  throw new Error(`expected a number, got ${JSON.stringify(value)}`);
}

function numbers(value: unknown, length: number): readonly number[] {
  if (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === 'number')
  ) {
    return value;
  }
  throw new Error(`expected ${length} numbers, got ${JSON.stringify(value)}`);
}

function hexByte(fraction: number): string {
  return Math.round(fraction * 255)
    .toString(16)
    .padStart(2, '0');
}

/**
 * An `srgb` `color` as CSS hex: its `hex` member when present, else the
 * components; `#rrggbbaa` when it is translucent.
 */
export function readColor(value: unknown): string {
  if (!isTokenTree(value) || value['colorSpace'] !== 'srgb') {
    throw new Error(`expected an srgb color, got ${JSON.stringify(value)}`);
  }
  const hex = value['hex'];
  const rgb =
    typeof hex === 'string' && /^#[0-9a-f]{6}$/.test(hex)
      ? hex
      : `#${numbers(value['components'], 3).map(hexByte).join('')}`;
  const alpha = value['alpha'] === undefined ? 1 : readNumber(value['alpha']);
  return alpha === 1 ? rgb : `${rgb}${hexByte(alpha)}`;
}

/** A `cubicBezier` as CSS `cubic-bezier(x1, y1, x2, y2)`. */
export function readCubicBezier(value: unknown): string {
  return `cubic-bezier(${numbers(value, 4).join(', ')})`;
}

/** A `fontFamily` as a CSS font stack; names with a space are quoted. */
export function readFontStack(value: unknown): string {
  const families = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(families) ||
    !families.every((family) => typeof family === 'string')
  ) {
    throw new Error(`expected font families, got ${JSON.stringify(value)}`);
  }
  return families
    .map((family) => (/\s/.test(family) ? `"${family}"` : family))
    .join(', ');
}
