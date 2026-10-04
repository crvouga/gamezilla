/**
 * dataSet → `data-*` attrs / `dataAttrs` spreads.
 * Never injects a host `data-component` — that stays on real `@pkgs/ui` hosts.
 * Never bails: every shape converts automatically.
 */

import ts from 'typescript';
import { attrExpression, getJsxAttr } from './transform-attrs';

export type DataSetConversion = {
  /** Static `data-*` attribute values (explicit keys only). */
  readonly attrs: Readonly<Record<string, string>>;
  /** Dynamic `data-*` bindings: key → expression text. */
  readonly exprAttrs: Readonly<Record<string, string>>;
  /**
   * When set, emit `{...dataAttrs(spreadArg)}` instead of
   * (or in addition to) per-key attrs.
   */
  readonly spreadArg?: string | undefined;
  /** Host name being converted — used only to drop redundant defaults. */
  readonly hostComponent: string;
};

/** Convert `dataSet` to static attrs, dynamic attrs, and/or a spread helper. */
export function convertDataSet(
  element: ts.JsxOpeningLikeElement,
  hostComponent: string,
  source: ts.SourceFile,
  peeledDataSetExpr?: string | undefined
): DataSetConversion {
  if (peeledDataSetExpr !== undefined) {
    return {
      attrs: {},
      exprAttrs: {},
      spreadArg: peeledDataSetExpr,
      hostComponent,
    };
  }
  const attr = getJsxAttr(element, 'dataSet');
  if (attr === undefined) {
    return { attrs: {}, exprAttrs: {}, hostComponent };
  }
  const expr = attrExpression(attr);
  if (expr === undefined) {
    return { attrs: {}, exprAttrs: {}, hostComponent };
  }
  if (!ts.isObjectLiteralExpression(expr)) {
    return {
      attrs: {},
      exprAttrs: {},
      spreadArg: expr.getText(source),
      hostComponent,
    };
  }
  return convertDataSetObject(expr, hostComponent, source);
}

function convertDataSetObject(
  expr: ts.ObjectLiteralExpression,
  hostComponent: string,
  source: ts.SourceFile
): DataSetConversion {
  const attrs: Record<string, string> = {};
  const exprAttrs: Record<string, string> = {};
  let hasSpread = false;
  for (const member of expr.properties) {
    if (ts.isSpreadAssignment(member)) {
      hasSpread = true;
      break;
    }
    if (!ts.isPropertyAssignment(member)) {
      hasSpread = true;
      break;
    }
    const keyText = propertyKeyText(member.name);
    if (keyText === undefined || !/^[A-Za-z][\w:.-]*$/.test(keyText)) {
      hasSpread = true;
      break;
    }
    const value = member.initializer;
    if (ts.isStringLiteral(value)) {
      if (keyText === 'component' && value.text === hostComponent) continue;
      attrs[keyText] = value.text;
      continue;
    }
    exprAttrs[keyText] = value.getText(source);
  }
  if (hasSpread) {
    return {
      attrs: {},
      exprAttrs: {},
      spreadArg: simplifyDataSetSpreadArg(expr, hostComponent, source),
      hostComponent,
    };
  }
  return { attrs, exprAttrs, hostComponent };
}

/**
 * `{ component: 'X', ...rest }` → `rest` when the only static key is the
 * host component name (redundant after migration); otherwise keep the object
 * literal text with that redundant key stripped.
 */
function simplifyDataSetSpreadArg(
  expr: ts.ObjectLiteralExpression,
  hostComponent: string,
  source: ts.SourceFile
): string {
  const props = expr.properties;
  if (props.length === 2) {
    const first = props[0];
    const second = props[1];
    if (
      first !== undefined &&
      second !== undefined &&
      ts.isPropertyAssignment(first) &&
      ts.isSpreadAssignment(second) &&
      propertyKeyText(first.name) === 'component' &&
      ts.isStringLiteral(first.initializer) &&
      first.initializer.text === hostComponent
    ) {
      return second.expression.getText(source);
    }
  }
  return rebuildWithoutHostComponent(expr, hostComponent, source);
}

function rebuildWithoutHostComponent(
  expr: ts.ObjectLiteralExpression,
  hostComponent: string,
  source: ts.SourceFile
): string {
  const parts: string[] = [];
  for (const member of expr.properties) {
    if (
      ts.isPropertyAssignment(member) &&
      propertyKeyText(member.name) === 'component' &&
      ts.isStringLiteral(member.initializer) &&
      member.initializer.text === hostComponent
    ) {
      continue;
    }
    parts.push(member.getText(source));
  }
  if (
    parts.length === 1 &&
    expr.properties.some((p) => ts.isSpreadAssignment(p))
  ) {
    const only = expr.properties.find((p) => ts.isSpreadAssignment(p));
    if (
      only !== undefined &&
      ts.isSpreadAssignment(only) &&
      parts.length === 1
    ) {
      return only.expression.getText(source);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

function propertyKeyText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/** JSX fragments for a converted dataSet. */
export function emitDataSetAttrs(data: DataSetConversion): {
  readonly dataAttrs: Readonly<Record<string, string>>;
  readonly dataAttrExprs: readonly string[];
  readonly dataAttrsSpread?: string | undefined;
} {
  if (data.spreadArg !== undefined) {
    return {
      dataAttrs: {},
      dataAttrExprs: [],
      dataAttrsSpread: `{...dataAttrs(${data.spreadArg})}`,
    };
  }
  const dataAttrExprs: string[] = [];
  for (const key of Object.keys(data.exprAttrs)) {
    dataAttrExprs.push(`data-${key}={${data.exprAttrs[key]}}`);
  }
  const dataAttrs: Record<string, string> = {};
  for (const key of Object.keys(data.attrs)) {
    dataAttrs[`data-${key}`] = data.attrs[key] ?? '';
  }
  return { dataAttrs, dataAttrExprs };
}
