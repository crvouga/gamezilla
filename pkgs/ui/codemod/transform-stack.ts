/**
 * Stack layout props → Box-like conversion (static extras or dynamic style).
 */

import ts from 'typescript';
import { invariant } from './tiger';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';
import {
  type ComponentConversion,
  convertBoxLike,
  type ExtraEntry,
} from './transform-shared';

type LayoutString =
  | { readonly kind: 'absent' }
  | { readonly kind: 'static'; readonly value: string }
  | { readonly kind: 'dynamic'; readonly expr: string };

type LayoutNumber =
  | { readonly kind: 'absent' }
  | { readonly kind: 'static'; readonly value: number }
  | { readonly kind: 'dynamic'; readonly expr: string };

type LayoutWrap =
  | { readonly kind: 'absent' }
  | { readonly kind: 'static'; readonly value: boolean }
  | { readonly kind: 'dynamic'; readonly expr: string };

export function convertStack(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  const layout = readStackLayout(element, source);
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Stack',
    baseClass: 'box',
    extras: layout.extras,
    extraAttrs: [],
    drops: ['direction', 'spacing', 'align', 'justify', 'wrap'],
    styleExtras: layout.styleExtras,
  });
}

function readStackLayout(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): { extras: readonly ExtraEntry[]; styleExtras: readonly string[] } {
  const extras: ExtraEntry[] = [];
  const styleExtras: string[] = [];
  const direction = readLayoutString(element, 'direction', source);
  if (direction.kind === 'absent') {
    extras.push({ prop: 'flexDirection', value: 'column' });
  } else if (direction.kind === 'static') {
    extras.push({
      prop: 'flexDirection',
      value: direction.value === 'horizontal' ? 'row' : 'column',
    });
  } else {
    styleExtras.push(
      `{ flexDirection: (${direction.expr}) === "horizontal" ? "row" : "column" }`
    );
  }
  const spacing = readLayoutNumber(element, 'spacing', source);
  if (spacing.kind === 'static') {
    extras.push({ prop: 'gap', value: spacing.value });
  } else if (spacing.kind === 'dynamic') {
    styleExtras.push(`{ gap: ${spacing.expr} }`);
  }
  const align = readLayoutString(element, 'align', source);
  if (align.kind === 'static') {
    extras.push({ prop: 'alignItems', value: align.value });
  } else if (align.kind === 'dynamic') {
    styleExtras.push(`{ alignItems: ${align.expr} }`);
  }
  const justify = readLayoutString(element, 'justify', source);
  if (justify.kind === 'static') {
    extras.push({ prop: 'justifyContent', value: justify.value });
  } else if (justify.kind === 'dynamic') {
    styleExtras.push(`{ justifyContent: ${justify.expr} }`);
  }
  const wrap = readLayoutWrap(element, source);
  if (wrap.kind === 'static' && wrap.value) {
    extras.push({ prop: 'flexWrap', value: 'wrap' });
  } else if (wrap.kind === 'dynamic') {
    styleExtras.push(`{ flexWrap: (${wrap.expr}) ? "wrap" : undefined }`);
  }
  return { extras, styleExtras };
}

function readLayoutString(
  element: ts.JsxOpeningLikeElement,
  name: string,
  source: ts.SourceFile
): LayoutString {
  const attr = getJsxAttr(element, name);
  if (attr === undefined) return { kind: 'absent' };
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return { kind: 'static', value: literal };
  const expr = attrExpression(attr);
  if (expr !== undefined && ts.isStringLiteral(expr)) {
    return { kind: 'static', value: expr.text };
  }
  if (expr !== undefined) {
    return { kind: 'dynamic', expr: expr.getText(source) };
  }
  return { kind: 'absent' };
}

function readLayoutNumber(
  element: ts.JsxOpeningLikeElement,
  name: string,
  source: ts.SourceFile
): LayoutNumber {
  const attr = getJsxAttr(element, name);
  if (attr === undefined) return { kind: 'absent' };
  const expr = attrExpression(attr);
  if (expr !== undefined && ts.isNumericLiteral(expr)) {
    const n = Number(expr.text);
    invariant(Number.isFinite(n), `Stack spacing is not finite`);
    return { kind: 'static', value: n };
  }
  if (expr !== undefined) {
    return { kind: 'dynamic', expr: expr.getText(source) };
  }
  return { kind: 'absent' };
}

function readLayoutWrap(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): LayoutWrap {
  const attr = getJsxAttr(element, 'wrap');
  if (attr === undefined) return { kind: 'absent' };
  if (attr.initializer === undefined) return { kind: 'static', value: true };
  const expr = attrExpression(attr);
  if (expr === undefined) return { kind: 'absent' };
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'static', value: true };
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'static', value: false };
  }
  return { kind: 'dynamic', expr: expr.getText(source) };
}
