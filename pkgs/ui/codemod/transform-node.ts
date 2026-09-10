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

/** Solid `classList` entry: literal class name or dynamic `[expr]` key. */
export type ClassListEntry =
  | { readonly className: string; readonly when: string }
  | { readonly keyExpr: string; readonly when: string };

export type NodeConversion = {
  readonly kind: 'converted';
  readonly tier: 'A' | 'B';
  readonly element: string;
  readonly classes: readonly string[];
  readonly styles: readonly StyleEntry[];
  /** Opaque sx expression texts merged into Solid `style={{...}}`. */
  readonly styleExprs: readonly string[];
  /** Conditional / dynamic classes for Solid `classList`. */
  readonly classList: readonly ClassListEntry[];
  readonly dataAttrs: Readonly<Record<string, string>>;
  /** Dynamic `data-*={expr}` attribute texts. */
  readonly dataAttrExprs: readonly string[];
  /** `{...dataAttrs(...)}` when dataSet is not fully static. */
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

/** Runtime drops this static prop too — omit instead of emitting style. */
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
  readonly styleExprs: string[];
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
    accum.styleExprs.push(runtimeObj('transform', entryRawText(entry, source)));
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
    // Unknown / unmappable dynamic props become Solid `style` object entries.
    accum.styleExprs.push(runtimeObj(entry.prop, entry.value.exprText));
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
    accum.styleExprs.push(runtimeObj(prop, raw));
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
    styleExprs: [],
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
  const dynamic = accum.hasDynamic || accum.styleExprs.length > 0;
  return {
    kind: 'converted',
    tier: dynamic ? 'B' : 'A',
    element: '',
    classes: mapped.classes,
    styles: accum.styles,
    styleExprs: accum.styleExprs,
    classList: [],
    dataAttrs: {},
    dataAttrExprs: [],
    dropSpreadTexts: [],
    dropAttrs: ['sx'],
    extraAttrs: [],
  };
}

/**
 * Convert ordered splices under the last-wins merge rule:
 *
 * - All-static runs flatten to one record (later entries override earlier)
 *   and map through the static tables.
 * - `cond ? {…} : null/false/undefined/{}` branches expand to `classList`.
 * - An unknown segment c-HELD into `classList` (removing earlier classes
 *   for the same CSS properties) preserves runtime last-wins.
 * - An unknown segment AFTER static overrides → those static props move to
 *   `style` (inline beats class) so runtime order semantics survive.
 */
export function convertSxParts(
  parts: readonly SplicePart[],
  source: ts.SourceFile
): NodeConversion {
  const staticEntries: ObjectEntry[] = [];
  const dynamicTail: string[] = [];
  let sawUnknown = false;
  for (const part of parts) {
    if (part.kind === 'static') {
      if (sawUnknown) continue;
      staticEntries.push(...part.entries);
      continue;
    }
    sawUnknown = true;
    const expanded = expandConditionalSx(part.exprText);
    if (expanded !== undefined) {
      dynamicTail.push(
        `{ ${expanded.classes.map((c) => JSON.stringify(c)).join(', ')}: ` +
          `!!(${expanded.branch}) }`
      );
      continue;
    }
    if (part.exprText !== 'false' && part.exprText !== 'undefined') {
      dynamicTail.push(part.exprText);
    }
  }
  const base = convertSxEntries(staticEntries, source);
  const classList: ClassListEntry[] = [...base.classList];
  const styles: StyleEntry[] = [...base.styles];
  const styleExprs: string[] = [...base.styleExprs];
  for (const chunk of dynamicTail) {
    if (isClassListMapText(chunk)) {
      classList.push(...parseClassListText(chunk));
      continue;
    }
    // Unknown after static: the overrides become inline style so runtime
    // last-wins still holds (inline declarations beat classes).
    styleExprs.push(chunk);
  }
  let tier: 'A' | 'B' = base.tier;
  if (classList.length > 0 || styleExprs.length > 0) tier = 'B';
  return {
    kind: 'converted',
    tier,
    element: '',
    classes: base.classes,
    styles,
    styleExprs,
    classList,
    dataAttrs: {},
    dataAttrExprs: [],
    dropSpreadTexts: [],
    dropAttrs: ['sx'],
    extraAttrs: [],
  };
}

/** Recognize a classList chunk the expander produced (`{ 'm-1': !!(c) }`). */
function isClassListMapText(chunk: string): boolean {
  return chunk.startsWith('{ ') && chunk.endsWith(': !!((') === false
    ? /^.*: !!\(.*\)$/.test(chunk)
    : false;
}

/** Parse back the classList text the expander emitted. */
function parseClassListText(chunk: string): readonly ClassListEntry[] {
  const inner = chunk.slice(2, -2).trim();
  const entries: ClassListEntry[] = [];
  for (const part of splitTopLevelCommas(inner)) {
    const m = /^(.*):\s*!!\((.*)\)$/.exec(part.trim());
    if (m === null) continue;
    const key = (m[1] ?? '').trim();
    const when = (m[2] ?? '').trim();
    if (key.startsWith('"') && key.endsWith('"')) {
      entries.push({ className: JSON.parse(key) as string, when });
    } else {
      entries.push({ keyExpr: key, when });
    }
  }
  return entries;
}

/** Split on top-level commas (bracket/paren/quote aware). */
function splitTopLevelCommas(text: string): readonly string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: '"' | "'" | '`' | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== undefined) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.filter((s) => s.trim().length > 0);
}

type ExpandedConditional = {
  readonly branch: string;
  readonly classes: readonly string[];
};

/**
 * `cond ? {…static…} : null/false/undefined/{}` → branch + mapped classes.
 * Covers ternaries, `cond && {…}` (desugars to the same shape), and `??`.
 */
export function expandConditionalSx(
  exprText: string
): ExpandedConditional | undefined {
  const wrapped = `(${exprText})`;
  const file = ts.createSourceFile(
    'expand.tsx',
    wrapped,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const stmt = file.statements[0];
  if (stmt === undefined || !ts.isExpressionStatement(stmt)) return undefined;
  let expr = stmt.expression;
  if (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  const conditional = asConditionalWithEmptyElse(expr);
  if (conditional === undefined) return undefined;
  if (!ts.isObjectLiteralExpression(conditional.whenTrue)) return undefined;
  const entries = readObjectEntriesFromLiteral(conditional.whenTrue);
  if (entries === undefined) return undefined;
  const converted = convertSxEntries(entries, file);
  if (
    converted.styleExprs.length > 0 ||
    converted.styles.length > 0 ||
    converted.classes.length === 0
  ) {
    return undefined;
  }
  return {
    branch: conditional.condition.getText(file),
    classes: converted.classes,
  };
}

function asConditionalWithEmptyElse(
  expr: ts.Expression
):
  | { readonly condition: ts.Expression; readonly whenTrue: ts.Expression }
  | undefined {
  if (ts.isConditionalExpression(expr)) {
    if (!isEmptySxBranch(expr.whenFalse)) return undefined;
    return { condition: expr.condition, whenTrue: expr.whenTrue };
  }
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    // `cond && {…}` — the right operand is the payload itself.
    return { condition: expr.left, whenTrue: expr.right };
  }
  return undefined;
}

/**
 * `cond ? { m: 1 } : null` → classList entries. Only static object true-branch
 * with empty/null/undefined/false false-branch.
 */
function peelConditionalSxClasses(
  exprText: string
): { readonly when: string; readonly classes: readonly string[] } | undefined {
  const wrapped = `(${exprText})`;
  const file = ts.createSourceFile(
    'peel.tsx',
    wrapped,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const stmt = file.statements[0];
  if (stmt === undefined || !ts.isExpressionStatement(stmt)) return undefined;
  let expr = stmt.expression;
  if (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  if (!ts.isConditionalExpression(expr)) return undefined;
  if (!isEmptySxBranch(expr.whenFalse)) return undefined;
  if (!ts.isObjectLiteralExpression(expr.whenTrue)) return undefined;
  const entries = readObjectEntriesFromLiteral(expr.whenTrue);
  if (entries === undefined) return undefined;
  const converted = convertSxEntries(entries, file);
  if (converted.styleExprs.length > 0 || converted.styles.length > 0) {
    return undefined;
  }
  if (converted.classes.length === 0) return undefined;
  return {
    when: expr.condition.getText(file),
    classes: converted.classes,
  };
}

function isEmptySxBranch(expr: ts.Expression): boolean {
  if (expr.kind === ts.SyntaxKind.NullKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (
    ts.isIdentifier(expr) &&
    (expr.text === 'undefined' || expr.text === 'null')
  ) {
    return true;
  }
  if (ts.isObjectLiteralExpression(expr) && expr.properties.length === 0) {
    return true;
  }
  return false;
}

function readObjectEntriesFromLiteral(
  node: ts.ObjectLiteralExpression
): ObjectEntry[] | undefined {
  const out: ObjectEntry[] = [];
  for (const member of node.properties) {
    if (!ts.isPropertyAssignment(member)) return undefined;
    const key =
      ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
        ? member.name.text
        : undefined;
    if (key === undefined) return undefined;
    const init = member.initializer;
    if (ts.isStringLiteral(init)) {
      out.push({
        prop: key,
        value: { kind: 'static', value: init.text },
        raw: init,
      });
      continue;
    }
    if (ts.isNumericLiteral(init)) {
      out.push({
        prop: key,
        value: { kind: 'static', value: Number(init.text) },
        raw: init,
      });
      continue;
    }
    if (init.kind === ts.SyntaxKind.TrueKeyword) {
      out.push({
        prop: key,
        value: { kind: 'static', value: true },
        raw: init,
      });
      continue;
    }
    if (init.kind === ts.SyntaxKind.FalseKeyword) {
      out.push({
        prop: key,
        value: { kind: 'static', value: false },
        raw: init,
      });
      continue;
    }
    if (init.kind === ts.SyntaxKind.NullKeyword) {
      out.push({
        prop: key,
        value: { kind: 'static', value: null },
        raw: init,
      });
      continue;
    }
    return undefined;
  }
  return out;
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
