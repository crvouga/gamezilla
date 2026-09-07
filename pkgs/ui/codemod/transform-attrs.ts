/**
 * Low-level JSX attribute helpers for the codemod transform.
 *
 * All helpers are pure: they read the TypeScript AST + source text and
 * return source slices. The transform applies span edits, so untouched
 * source (children, passthrough props, comments) stays byte-identical.
 */

import ts from 'typescript';
import type { StaticValue } from './mapping-types';

export type ValueRef =
  | { readonly kind: 'static'; readonly value: StaticValue }
  | { readonly kind: 'dynamic'; readonly exprText: string }
  | { readonly kind: 'spread' };

export type TransformPiece = {
  readonly key: string;
  readonly value: string | number;
};

export type TransformRef =
  | { readonly kind: 'pieces'; readonly pieces: readonly TransformPiece[] }
  | { readonly kind: 'dynamic' };

export function getJsxAttr(
  element: ts.JsxOpeningLikeElement,
  name: string
): ts.JsxAttribute | undefined {
  for (const attr of element.attributes.properties) {
    if (ts.isJsxAttribute(attr) && attr.name.getText() === name) return attr;
  }
  return undefined;
}

/** Classify an expression as a static literal, a dynamic splice, or other. */
export function classifyValue(node: ts.Expression, source: ts.SourceFile): ValueRef {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: 'static', value: node.text };
  }
  if (ts.isNumericLiteral(node)) {
    return { kind: 'static', value: Number(node.text) };
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken ||
      node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const n = Number(node.operand.text);
    return {
      kind: 'static',
      value: node.operator === ts.SyntaxKind.MinusToken ? 0 - n : n,
    };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'static', value: true };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'static', value: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: 'static', value: null };
  }
  return { kind: 'dynamic', exprText: node.getText(source) };
}

/** Parse an sx `transform` array into static pieces (or dynamic). */
export function classifyTransform(
  node: ts.Expression,
  source: ts.SourceFile
): TransformRef {
  if (!ts.isArrayLiteralExpression(node)) return { kind: 'dynamic' };
  const pieces: TransformPiece[] = [];
  for (const el of node.elements) {
    if (!ts.isObjectLiteralExpression(el)) return { kind: 'dynamic' };
    if (el.properties.length !== 1) return { kind: 'dynamic' };
    const prop = el.properties[0];
    if (prop === undefined || !ts.isPropertyAssignment(prop)) {
      return { kind: 'dynamic' };
    }
    const key = propName(prop.name);
    const value = classifyValue(prop.initializer, source);
    if (key === undefined || value.kind !== 'static') return { kind: 'dynamic' };
    if (typeof value.value !== 'string' && typeof value.value !== 'number') {
      return { kind: 'dynamic' };
    }
    pieces.push({ key, value: value.value });
  }
  return { kind: 'pieces', pieces };
}

function propName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

export type ObjectEntry = {
  readonly prop: string;
  readonly value: ValueRef;
  readonly raw: ts.Expression;
};

/**
 * Read a plain object literal's entries. Returns `undefined` when the
 * literal contains spreads, shorthand, methods, or computed names.
 */
export function readObjectEntries(
  node: ts.ObjectLiteralExpression,
  source: ts.SourceFile
): ObjectEntry[] | undefined {
  const out: ObjectEntry[] = [];
  for (const member of node.properties) {
    if (!ts.isPropertyAssignment(member)) return undefined;
    const key = propName(member.name);
    if (key === undefined) return undefined;
    out.push({
      prop: key,
      value: classifyValue(member.initializer, source),
      raw: member.initializer,
    });
  }
  return out;
}

/** Attribute expression text (for `attr={expr}`), or undefined. */
export function attrExpression(
  attr: ts.JsxAttribute,
  source: ts.SourceFile
): ts.Expression | undefined {
  const init = attr.initializer;
  if (init === undefined || !ts.isJsxExpression(init)) return undefined;
  return init.expression;
}

/** String value of `attr="literal"`, or undefined. */
export function attrStringLiteral(attr: ts.JsxAttribute): string | undefined {
  const init = attr.initializer;
  if (init !== undefined && ts.isStringLiteral(init)) return init.text;
  return undefined;
}
