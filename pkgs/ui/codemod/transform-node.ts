/**
 * Shared node-conversion types plus sx/dataSet/as/class readers.
 *
 * Pure: everything reads the TypeScript AST + source text and returns data.
 * `transform-components.ts` dispatches per component; `transform.ts` turns
 * conversions into span edits.
 */

import ts from 'typescript';
import type { DynamicWrap, StaticValue } from './mapping-types';
import { compileStaticTransform } from './sx-map-effect';
import { mapDynamicProp, mapSxRecord } from './sx-mapping';
import { invariant } from './tiger';
import {
  attrExpression,
  attrStringLiteral,
  classifyTransform,
  getJsxAttr,
  type ObjectEntry,
  readObjectEntries,
} from './transform-attrs';

export type StyleEntry = {
  readonly cssProp: string;
  readonly exprText: string;
  readonly wrap: DynamicWrap;
};

export type NodeConversion =
  | {
      readonly kind: 'converted';
      readonly tier: 'A' | 'B';
      readonly element: string;
      readonly classes: readonly string[];
      readonly styles: readonly StyleEntry[];
      readonly dataAttrs: Readonly<Record<string, string>>;
      /** Attributes to drop (sx, as, dataSet, feedback, label, …). */
      readonly dropAttrs: readonly string[];
      /** Literal attributes to inject (e.g. Clickable's default type). */
      readonly extraAttrs: readonly string[];
      /** Text `label` becomes children (expression text). */
      readonly labelAsChildren?: string | undefined;
    }
  | { readonly kind: 'manual'; readonly reason: string };

export type ExistingClass =
  | { readonly kind: 'absent' }
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'expr'; readonly exprText: string };

export type SxRead =
  | { readonly kind: 'record'; readonly entries: readonly ObjectEntry[] }
  | { readonly kind: 'manual'; readonly reason: string }
  | { readonly kind: 'absent' };

/** Read an `sx`-shaped attribute (`sx` or `frameSx`) into merged entries. */
export function readSxAttr(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  attrName: string
): SxRead {
  const attr = getJsxAttr(element, attrName);
  if (attr === undefined) return { kind: 'absent' };
  const expr = attrExpression(attr);
  if (expr === undefined) {
    return { kind: 'manual', reason: `${attrName} is not an expression` };
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const entries = readObjectEntries(expr, source);
    if (entries === undefined) {
      return { kind: 'manual', reason: `${attrName} object has spread keys` };
    }
    return { kind: 'record', entries };
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return readSxArray(expr, source, attrName);
  }
  return { kind: 'manual', reason: `${attrName} is not a literal (Tier C)` };
}

function readSxArray(
  expr: ts.ArrayLiteralExpression,
  source: ts.SourceFile,
  attrName: string
): SxRead {
  const merged: ObjectEntry[] = [];
  for (const el of expr.elements) {
    if (ts.isObjectLiteralExpression(el)) {
      const entries = readObjectEntries(el, source);
      if (entries === undefined) {
        return { kind: 'manual', reason: `${attrName} entry is not an object` };
      }
      merged.push(...entries);
      continue;
    }
    if (el.kind === ts.SyntaxKind.NullKeyword) continue;
    if (el.kind === ts.SyntaxKind.FalseKeyword) continue;
    return { kind: 'manual', reason: `${attrName} array is dynamic (Tier C)` };
  }
  return { kind: 'record', entries: merged };
}

/** Convert merged sx entries (transform compiled from its raw AST). */
export function convertSxEntries(
  entries: readonly ObjectEntry[],
  source: ts.SourceFile
): NodeConversion {
  const record: Record<string, StaticValue> = {};
  const styles: StyleEntry[] = [];
  let transformClass: string | undefined;
  let hasDynamic = false;
  for (const entry of entries) {
    if (entry.prop === 'transform') {
      const compiled = convertTransformEntry(entry, source);
      if (compiled === undefined) {
        return { kind: 'manual', reason: 'transform is not fully static' };
      }
      if (compiled !== '') transformClass = compiled;
      continue;
    }
    if (entry.value.kind === 'static') {
      record[entry.prop] = entry.value.value;
      continue;
    }
    if (entry.value.kind === 'spread') {
      return { kind: 'manual', reason: 'sx has a spread entry' };
    }
    const mapped = mapDynamicProp(entry.prop);
    if (mapped.kind === 'bail') {
      return { kind: 'manual', reason: mapped.reason };
    }
    hasDynamic = true;
    for (const cssProp of mapped.cssProps) {
      styles.push({
        cssProp,
        exprText: entry.value.exprText,
        wrap: mapped.wrap,
      });
    }
  }
  const mapped = mapSxRecord(record, transformClass);
  if (mapped.bailed.length > 0) {
    return { kind: 'manual', reason: `no mapping for ${mapped.bailed[0]}` };
  }
  return {
    kind: 'converted',
    tier: hasDynamic ? 'B' : 'A',
    element: '',
    classes: mapped.classes,
    styles,
    dataAttrs: {},
    dropAttrs: ['sx'],
    extraAttrs: [],
  };
}

function convertTransformEntry(
  entry: ObjectEntry,
  source: ts.SourceFile
): string | undefined {
  const ref = classifyTransform(entry.raw, source);
  if (ref.kind === 'dynamic') return undefined;
  return compileStaticTransform(ref.pieces) ?? '';
}

export type DataSetRead =
  | { readonly kind: 'attrs'; readonly attrs: Readonly<Record<string, string>> }
  | { readonly kind: 'manual'; readonly reason: string };

/** Materialize `dataSet` to exact `data-*` attributes (dev/E2E parity). */
export function readDataSet(
  element: ts.JsxOpeningLikeElement,
  defaultComponent: string
): DataSetRead {
  const merged: Record<string, string> = { component: defaultComponent };
  const attr = getJsxAttr(element, 'dataSet');
  if (attr === undefined) return { kind: 'attrs', attrs: merged };
  const expr = attrExpression(attr);
  if (expr === undefined || !ts.isObjectLiteralExpression(expr)) {
    return { kind: 'manual', reason: 'dataSet is not an object literal' };
  }
  for (const member of expr.properties) {
    if (!ts.isPropertyAssignment(member)) {
      return { kind: 'manual', reason: 'dataSet has a spread entry' };
    }
    const key = member.name;
    const keyText =
      ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined;
    const value = member.initializer;
    if (
      keyText === undefined ||
      !/^[A-Za-z][\w:.-]*$/.test(keyText) ||
      !ts.isStringLiteral(value)
    ) {
      return { kind: 'manual', reason: 'dataSet entry is not static' };
    }
    merged[keyText] = value.text;
  }
  return { kind: 'attrs', attrs: merged };
}

/** `data-*` attribute map from a merged dataSet record. */
export function toDataAttrs(
  attrs: Readonly<Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(attrs)) {
    invariant(/^[A-Za-z][\w:.-]*$/.test(key), `bad dataSet key ${key}`);
    out[`data-${key}`] = attrs[key] ?? '';
  }
  return out;
}

/** Read `as="x"`; dynamic markers and non-intrinsics bail via `undefined`. */
export function readAsElement(
  element: ts.JsxOpeningLikeElement,
  fallback: string
): string | undefined {
  const attr = getJsxAttr(element, 'as');
  if (attr === undefined) return fallback;
  const literal = attrStringLiteral(attr);
  if (literal !== undefined && /^[a-z][\w-]*$/.test(literal)) return literal;
  return undefined;
}

/** Read `class`; template literals with substitutions bail via `undefined`. */
export function readExistingClass(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ExistingClass | undefined {
  const attr = getJsxAttr(element, 'class');
  if (attr === undefined) return { kind: 'absent' };
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return { kind: 'literal', value: literal };
  const expr = attrExpression(attr);
  if (expr === undefined) return undefined;
  if (ts.isTemplateExpression(expr)) return undefined;
  if (ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { kind: 'literal', value: expr.text };
  }
  return { kind: 'expr', exprText: expr.getText(source) };
}
