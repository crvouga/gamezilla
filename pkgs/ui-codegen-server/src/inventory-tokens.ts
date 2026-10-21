/**
 * Flattens a W3C Design Tokens document into one fact per token (its path,
 * inherited `$type`, exact `$value` and alias) and reads the custom
 * properties a compiled stylesheet declares, block by block.
 */
import type { CssVarFact, TokenFact } from './inventory-types';

type Node = { readonly [key: string]: unknown };

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ALIAS = /^\{([^}]+)\}$/;

function valueText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function tokenFact(path: string, node: Node, inheritedType: string): TokenFact {
  const value = node['$value'];
  const alias =
    typeof value === 'string' ? (value.match(ALIAS)?.[1] ?? null) : null;
  return {
    path,
    type: typeof node['$type'] === 'string' ? node['$type'] : inheritedType,
    value: valueText(value),
    alias,
    description:
      typeof node['$description'] === 'string' ? node['$description'] : '',
  };
}

/** Every token of the document, in document order. */
export function flattenTokens(tree: unknown): TokenFact[] {
  const out: TokenFact[] = [];
  const walk = (node: unknown, path: readonly string[], type: string): void => {
    if (!isNode(node)) return;
    const ownType = typeof node['$type'] === 'string' ? node['$type'] : type;
    if ('$value' in node) {
      out.push(tokenFact(path.join('.'), node, ownType));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$')) walk(child, [...path, key], ownType);
    }
  };
  walk(tree, [], '');
  return out;
}

/** Each `--name: value;` of a stylesheet with the selector it sits in. */
export function readCssVars(css: string): CssVarFact[] {
  const out: CssVarFact[] = [];
  const blocks = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const [, selector = '', body = ''] of blocks) {
    const block = selector.trim().replace(/\s+/g, ' ');
    for (const [, name = '', value = ''] of body.matchAll(
      /(--[\w-]+)\s*:\s*([^;]+);/g
    )) {
      out.push({ block, name, value: value.trim().replace(/\s+/g, ' ') });
    }
  }
  return out;
}
