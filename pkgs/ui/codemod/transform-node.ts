/**
 * Shared node-conversion types plus sx/dataSet/as/class readers.
 *
 * Pure: everything reads the TypeScript AST + source text and returns data.
 * `transform-components.ts` dispatches per component; `transform.ts` turns
 * conversions into span edits.
 */

import ts from 'typescript';
import { CSS_VAR_COLORS, cssVarElevation } from '../src/theme/css-vars';
import { sxToCss } from '../src/theme/sx-to-css';
import type { DynamicWrap, StaticValue } from './mapping-types';
import { compileStaticTransform } from './sx-map-effect';
import { mapDynamicProp, mapSxRecord } from './sx-mapping';
import {
  attrExpression,
  attrStringLiteral,
  classifyTransform,
  getJsxAttr,
  type ObjectEntry,
  readObjectSplices,
  type SplicePart,
} from './transform-attrs';

export type StyleEntry = {
  readonly cssProp: string;
  readonly exprText: string;
  readonly wrap: DynamicWrap;
};

export type NodeConversion = {
  readonly kind: 'converted';
  readonly tier: 'A' | 'B';
  readonly element: string;
  readonly classes: readonly string[];
  readonly styles: readonly StyleEntry[];
  /** Runtime `SxProps` texts — spliced into `cn(...)` + `cnStyle(...)`. */
  readonly cnExprs: readonly string[];
  /** Class-only exprs (`TEXT_VARIANT_CLASS[…]`, feedback ternaries) for `cn`. */
  readonly classExprs: readonly string[];
  readonly dataAttrs: Readonly<Record<string, string>>;
  /** Dynamic `data-*={expr}` attribute texts. */
  readonly dataAttrExprs: readonly string[];
  /** `{...componentDataAttrs(...)}` when dataSet is not fully static. */
  readonly dataAttrsSpread?: string | undefined;
  /** Exact spread texts peeled into the conversion (omit from passthrough). */
  readonly dropSpreadTexts: readonly string[];
  /** Attributes to drop (sx, as, dataSet, feedback, label, …). */
  readonly dropAttrs: readonly string[];
  /** Literal attributes to inject (e.g. Clickable's default type). */
  readonly extraAttrs: readonly string[];
  /** Text `label` becomes children (expression text). */
  readonly labelAsChildren?: string | undefined;
};

export type ExistingClass =
  | { readonly kind: 'absent' }
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'expr'; readonly exprText: string };

export type SxRead =
  | { readonly kind: 'record'; readonly entries: readonly ObjectEntry[] }
  | { readonly kind: 'splices'; readonly parts: readonly SplicePart[] }
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
  if (expr === undefined) return { kind: 'record', entries: [] };
  if (ts.isObjectLiteralExpression(expr)) {
    return splicesOrRecord(readObjectSplices(expr, source));
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return splicesOrRecord(readSxArrayParts(expr, source));
  }
  return {
    kind: 'splices',
    parts: [{ kind: 'expr', exprText: expr.getText(source) }],
  };
}

function splicesOrRecord(parts: readonly SplicePart[]): SxRead {
  if (parts.every((p) => p.kind === 'static')) {
    const entries: ObjectEntry[] = [];
    for (const part of parts) {
      if (part.kind === 'static') entries.push(...part.entries);
    }
    return { kind: 'record', entries };
  }
  return { kind: 'splices', parts };
}

function readSxArrayParts(
  expr: ts.ArrayLiteralExpression,
  source: ts.SourceFile
): readonly SplicePart[] {
  const parts: SplicePart[] = [];
  for (const el of expr.elements) {
    if (ts.isObjectLiteralExpression(el)) {
      parts.push(...readObjectSplices(el, source));
      continue;
    }
    if (
      el.kind === ts.SyntaxKind.NullKeyword ||
      el.kind === ts.SyntaxKind.FalseKeyword ||
      el.kind === ts.SyntaxKind.TrueKeyword
    ) {
      continue;
    }
    parts.push({ kind: 'expr', exprText: el.getText(source) });
  }
  return parts;
}

/** Runtime drops this static prop too — omit instead of emitting `cn`. */
function dropsLikeRuntime(prop: string, value: StaticValue): boolean {
  const css = sxToCss({ [prop]: value } as Record<string, StaticValue>, {
    colors: CSS_VAR_COLORS,
    elevation: cssVarElevation,
  });
  return css === '';
}

function runtimeObj(prop: string, exprText: string): string {
  return `{ ${prop}: ${exprText} }`;
}

function entryRawText(entry: ObjectEntry, source: ts.SourceFile): string {
  try {
    const raw = (entry as { raw?: unknown }).raw;
    if (
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as { getText?: unknown }).getText === 'function'
    ) {
      return (raw as ts.Expression).getText(source);
    }
  } catch {
    // Synthetic entries (layout extras) carry no AST — fall through.
  }
  return entry.value.kind === 'static'
    ? JSON.stringify(entry.value.value)
    : entry.value.kind === 'dynamic'
      ? entry.value.exprText
      : 'undefined';
}

type EntryAccum = {
  readonly record: Record<string, StaticValue>;
  readonly raws: Record<string, string>;
  readonly styles: StyleEntry[];
  readonly cnExprs: string[];
  transformClass: string | undefined;
  hasDynamic: boolean;
};

function applyTransformEntry(
  accum: EntryAccum,
  entry: ObjectEntry,
  source: ts.SourceFile
): void {
  const compiled = convertTransformEntry(entry, source);
  if (compiled === undefined) {
    accum.cnExprs.push(runtimeObj('transform', entryRawText(entry, source)));
    accum.hasDynamic = true;
    return;
  }
  if (compiled !== '') accum.transformClass = compiled;
}

function applyValueEntry(accum: EntryAccum, entry: ObjectEntry): void {
  if (entry.value.kind === 'static') {
    accum.record[entry.prop] = entry.value.value;
    return;
  }
  if (entry.value.kind === 'spread') return;
  if (entry.prop === 'fontVariant') return;
  const mapped = mapDynamicProp(entry.prop);
  if (mapped.kind === 'bail') {
    // Unknown or unmappable dynamic props must ride `cn`/`cnStyle` — never
    // silently drop (static unknowns go through applyBailedProps the same way).
    accum.cnExprs.push(runtimeObj(entry.prop, entry.value.exprText));
    accum.hasDynamic = true;
    return;
  }
  accum.hasDynamic = true;
  for (const cssProp of mapped.cssProps) {
    accum.styles.push({
      cssProp,
      exprText: entry.value.exprText,
      wrap: mapped.wrap,
    });
  }
}

function applyBailedProps(accum: EntryAccum, bailed: readonly string[]): void {
  for (const prop of bailed) {
    const value = accum.record[prop];
    if (value !== undefined && dropsLikeRuntime(prop, value)) continue;
    const raw = accum.raws[prop] ?? JSON.stringify(value ?? null);
    accum.cnExprs.push(runtimeObj(prop, raw));
    accum.hasDynamic = true;
  }
}

/** Convert merged sx entries (transform compiled from its raw AST). */
export function convertSxEntries(
  entries: readonly ObjectEntry[],
  source: ts.SourceFile
): NodeConversion {
  const accum: EntryAccum = {
    record: {},
    raws: {},
    styles: [],
    cnExprs: [],
    transformClass: undefined,
    hasDynamic: false,
  };
  for (const entry of entries) {
    if (entry.prop === 'transform') {
      applyTransformEntry(accum, entry, source);
      continue;
    }
    if (entry.value.kind === 'static') {
      accum.record[entry.prop] = entry.value.value;
      accum.raws[entry.prop] = entryRawText(entry, source);
      continue;
    }
    applyValueEntry(accum, entry);
  }
  const mapped = mapSxRecord(accum.record, accum.transformClass);
  applyBailedProps(accum, mapped.bailed);
  const dynamic = accum.hasDynamic || accum.cnExprs.length > 0;
  return {
    kind: 'converted',
    tier: dynamic ? 'B' : 'A',
    element: '',
    classes: mapped.classes,
    styles: accum.styles,
    cnExprs: accum.cnExprs,
    classExprs: [],
    dataAttrs: {},
    dataAttrExprs: [],
    dropSpreadTexts: [],
    dropAttrs: ['sx'],
    extraAttrs: [],
  };
}

/** Convert ordered splices: static chunks via tables, exprs via `cn`. */
export function convertSxParts(
  parts: readonly SplicePart[],
  source: ts.SourceFile
): NodeConversion {
  const classes: string[] = [];
  const styles: StyleEntry[] = [];
  const cnExprs: string[] = [];
  let tier: 'A' | 'B' = 'A';
  for (const part of parts) {
    if (part.kind === 'expr') {
      cnExprs.push(part.exprText);
      tier = 'B';
      continue;
    }
    const converted = convertSxEntries(part.entries, source);
    classes.push(...converted.classes);
    styles.push(...converted.styles);
    cnExprs.push(...converted.cnExprs);
    if (converted.tier === 'B') tier = 'B';
  }
  if (cnExprs.length > 0) tier = 'B';
  return {
    kind: 'converted',
    tier,
    element: '',
    classes,
    styles,
    cnExprs,
    classExprs: [],
    dataAttrs: {},
    dataAttrExprs: [],
    dropSpreadTexts: [],
    dropAttrs: ['sx'],
    extraAttrs: [],
  };
}

function convertTransformEntry(
  entry: ObjectEntry,
  source: ts.SourceFile
): string | undefined {
  if (
    typeof (entry as { raw?: unknown }).raw !== 'object' ||
    (entry as { raw?: unknown }).raw === null
  ) {
    return '';
  }
  const ref = classifyTransform(entry.raw, source);
  if (ref.kind === 'dynamic') return undefined;
  return compileStaticTransform(ref.pieces) ?? '';
}

/** Read `as="x"`; dynamic / non-intrinsic falls back to the default host. */
export function readAsElement(
  element: ts.JsxOpeningLikeElement,
  fallback: string
): string {
  const attr = getJsxAttr(element, 'as');
  if (attr === undefined) return fallback;
  const literal = attrStringLiteral(attr);
  if (literal !== undefined && /^[a-z][\w-]*$/.test(literal)) return literal;
  return fallback;
}

/** Read `class` — literals, templates, and expressions all convert. */
export function readExistingClass(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ExistingClass {
  const attr = getJsxAttr(element, 'class');
  if (attr === undefined) return { kind: 'absent' };
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return { kind: 'literal', value: literal };
  const expr = attrExpression(attr);
  if (expr === undefined) return { kind: 'absent' };
  if (ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { kind: 'literal', value: expr.text };
  }
  return { kind: 'expr', exprText: expr.getText(source) };
}
