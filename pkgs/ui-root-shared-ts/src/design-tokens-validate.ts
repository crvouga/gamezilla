/**
 * Shape check for a W3C Design Tokens tree: every leaf carries a `$value`
 * and a `$type` it can resolve (its own, the nearest group's, or the token
 * it aliases), every value fits its type, and every `{alias}` ends at a
 * token of the same type.
 *
 * Pure over the given tree; `tests/design-tokens.test.ts` runs it against
 * `design-tokens.json`.
 */

import type { TokenTree } from './design-tokens';
import { aliasPath, isTokenTree } from './design-tokens';

export const TOKEN_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'shadow',
  'typography',
] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export type TokenIssue = { readonly path: string; readonly message: string };

type FlatToken = {
  readonly path: string;
  readonly value: unknown;
  /** Own or inherited `$type`; undefined when only an alias can supply it. */
  readonly type: string | undefined;
};

const GROUP_KEYS = new Set(['$type', '$description', '$extensions']);
const TOKEN_KEYS = new Set(['$value', '$type', '$description', '$extensions']);
const NAME_FORBIDDEN = /[{}.]/;
const ALIAS_DEPTH_MAX = 16;

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isQuantity(value: unknown, units: readonly string[]): boolean {
  return (
    isTokenTree(value) &&
    isNumber(value['value']) &&
    typeof value['unit'] === 'string' &&
    units.includes(value['unit'])
  );
}

function isColor(value: unknown): boolean {
  if (!isTokenTree(value) || typeof value['colorSpace'] !== 'string') {
    return false;
  }
  const components = value['components'];
  const alpha = value['alpha'];
  return (
    Array.isArray(components) &&
    components.length === 3 &&
    components.every((item) => isNumber(item) || item === 'none') &&
    (alpha === undefined || (isNumber(alpha) && alpha >= 0 && alpha <= 1))
  );
}

function isCubicBezier(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isNumber)) {
    return false;
  }
  const [x1, , x2] = value;
  return [x1, x2].every((x) => x !== undefined && x >= 0 && x <= 1);
}

function isFontFamily(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  );
}

/** A W3C shadow: a color (or `{alias}` to one) and four px dimensions. */
function isShadow(value: unknown): boolean {
  if (!isTokenTree(value)) return false;
  const color = value['color'];
  return (
    (isColor(color) || aliasPath(color) !== undefined) &&
    ['offsetX', 'offsetY', 'blur', 'spread'].every((key) =>
      isQuantity(value[key], ['px', 'rem'])
    )
  );
}

const TYPOGRAPHY_PARTS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
] as const;

/** A W3C typography: family, size, weight and line height, each an alias. */
function isTypography(value: unknown): boolean {
  if (!isTokenTree(value)) return false;
  return TYPOGRAPHY_PARTS.every((part) => aliasPath(value[part]) !== undefined);
}

const VALUE_VERIFICATIONS: Readonly<
  Record<TokenType, (value: unknown) => boolean>
> = {
  color: isColor,
  dimension: (value) => isQuantity(value, ['px', 'rem']),
  fontFamily: isFontFamily,
  fontWeight: (value) =>
    (isNumber(value) && value >= 1 && value <= 1000) ||
    (typeof value === 'string' && value.length > 0),
  duration: (value) => isQuantity(value, ['ms', 's']),
  cubicBezier: isCubicBezier,
  number: isNumber,
  shadow: isShadow,
  typography: isTypography,
};

function isTokenType(type: string | undefined): type is TokenType {
  return (TOKEN_TYPES as readonly string[]).includes(type ?? '');
}

function checkKeys(
  node: TokenTree,
  path: string,
  allowed: ReadonlySet<string>,
  issues: TokenIssue[]
): void {
  for (const key of Object.keys(node)) {
    if (key.startsWith('$') && !allowed.has(key)) {
      issues.push({ path, message: `unknown property ${key}` });
    }
  }
}

type Flat = {
  readonly tokens: Map<string, FlatToken>;
  readonly issues: TokenIssue[];
};

/** Every token of the tree, with the `$type` it inherits from its groups. */
function flatten(
  node: TokenTree,
  path: string,
  inherited: string | undefined,
  out: Flat
): void {
  const own = node['$type'];
  if (own !== undefined && typeof own !== 'string') {
    out.issues.push({ path, message: '$type must be a string' });
  }
  const type = typeof own === 'string' ? own : inherited;
  if ('$value' in node) {
    checkKeys(node, path, TOKEN_KEYS, out.issues);
    for (const key of Object.keys(node)) {
      if (!key.startsWith('$')) {
        out.issues.push({ path, message: `a token cannot hold ${key}` });
      }
    }
    out.tokens.set(path, { path, value: node['$value'], type });
    return;
  }
  checkKeys(node, path, GROUP_KEYS, out.issues);
  const children = Object.keys(node).filter((key) => !key.startsWith('$'));
  if (children.length === 0 && path !== '') {
    out.issues.push({ path, message: 'a leaf must have a $value' });
  }
  for (const name of children) {
    const childPath = path === '' ? name : `${path}.${name}`;
    if (NAME_FORBIDDEN.test(name)) {
      out.issues.push({ path: childPath, message: 'name contains { } or .' });
    }
    const child = node[name];
    if (isTokenTree(child)) flatten(child, childPath, type, out);
    else out.issues.push({ path: childPath, message: 'a leaf needs a $value' });
  }
}

type Resolved = { readonly value: unknown; readonly type: string | undefined };

/** The token an alias chain ends at, or the reason it does not end. */
function resolve(
  token: FlatToken,
  tokens: ReadonlyMap<string, FlatToken>
): Resolved | string {
  let current = token;
  for (let depth = 0; depth < ALIAS_DEPTH_MAX; depth++) {
    const path = aliasPath(current.value);
    if (path === undefined) {
      return { value: current.value, type: token.type ?? current.type };
    }
    const target = tokens.get(path);
    if (target === undefined) return `alias {${path}} names no token`;
    if (
      token.type !== undefined &&
      target.type !== undefined &&
      target.type !== token.type
    ) {
      return `alias {${path}} is a ${target.type}, not a ${token.type}`;
    }
    current = target;
  }
  return 'alias is circular';
}

/** Every way `tree` departs from the format; empty when it is valid. */
export function validateDesignTokens(tree: unknown): readonly TokenIssue[] {
  if (!isTokenTree(tree)) return [{ path: '', message: 'not an object' }];
  const out: Flat = { tokens: new Map(), issues: [] };
  flatten(tree, '', undefined, out);
  const issues = out.issues;
  for (const token of out.tokens.values()) {
    const resolved = resolve(token, out.tokens);
    if (typeof resolved === 'string') {
      issues.push({ path: token.path, message: resolved });
    } else if (!isTokenType(resolved.type)) {
      issues.push({
        path: token.path,
        message: `no resolvable $type (${String(resolved.type)})`,
      });
    } else if (!VALUE_VERIFICATIONS[resolved.type](resolved.value)) {
      issues.push({
        path: token.path,
        message: `$value is not a ${resolved.type}`,
      });
    }
  }
  return issues;
}

/** Paths of every token in `tree`, in source order. */
export function designTokenPaths(tree: unknown): readonly string[] {
  if (!isTokenTree(tree)) return [];
  const out: Flat = { tokens: new Map(), issues: [] };
  flatten(tree, '', undefined, out);
  return [...out.tokens.keys()];
}
