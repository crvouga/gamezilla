/**
 * File-level transform: parse → convert each primitive usage via span edits
 * → re-parse to prove validity → prune unused primitive imports.
 *
 * Pure (string in, string out). Every convertible always converts (Tier A/B).
 * Non-convertibles and unrecognized hosts are left untouched — never TODO.
 *
 * Nested JSX is converted leaf-first across passes so parent label/children
 * edits never overlap descendant tag edits (which would throw in applyEdits).
 * Invariant failures become file-level `parseError` results — never throws.
 */

import ts from 'typescript';
import { splitTopLevel } from './split-top-level';
import { invariant, nonEmptyString } from './tiger';
import { CLASS_HELPER_NAMES, classAttrs } from './transform-class-peel';
import {
  collectNodes,
  isLeafNode,
  lineOf,
  type PendingNode,
  resolveBindings,
  tagName,
} from './transform-collect';
import {
  type ComponentConversion,
  convertComponent,
  isConvertibleExport,
} from './transform-components';
import {
  applyEdits,
  ensureRuntimeImports,
  fileNameOf,
  parse,
  pruneImports,
  type SpanEdit,
  syntaxErrors,
} from './transform-imports';
import type { ExistingClass } from './transform-node';
import { purgeClassHelpers } from './transform-purge-helpers';
import type { PrefixedSlot } from './transform-shared';

export type ConvertedNode = {
  readonly line: number;
  readonly component: string;
  readonly tier: 'A' | 'B';
};

export type ManualNode = {
  readonly line: number;
  readonly component: string;
  readonly reason: string;
};

export type FileResult = {
  readonly text: string;
  readonly changed: boolean;
  readonly converted: readonly ConvertedNode[];
  /** Always empty — the transform never leaves manual TODOs. */
  readonly manual: readonly ManualNode[];
  readonly parseError?: string | undefined;
};

const MAX_CONVERT_PASSES = 64;

/** Escape a static string into a double-quoted JSX attribute value. */
function quoteAttr(value: string): string {
  return `"${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
}

function styleBinding(
  styles: readonly { cssProp: string; exprText: string; wrap: string }[],
  styleExprs: readonly string[]
): string | undefined {
  if (styles.length === 0 && styleExprs.length === 0) return undefined;
  const parts = styles.map((s) => {
    if (s.wrap === 'raw') return `${JSON.stringify(s.cssProp)}: ${s.exprText}`;
    if (s.wrap === 'scaled') {
      return `${JSON.stringify(s.cssProp)}: \`\${(${s.exprText}) * 4}px\``;
    }
    return (
      `${JSON.stringify(s.cssProp)}: (typeof (${s.exprText}) === "number" ` +
      `? \`${'${'}(${s.exprText})}px\` : (${s.exprText}))`
    );
  });
  const merges = styleExprs
    .map((e) => solidStyleMerge(e))
    .filter((m) => m.length > 0);
  invariant(
    parts.length > 0 || merges.length > 0,
    'styleBinding needs at least one entry'
  );
  const binding = `style={{ ${[...merges, ...parts].join(', ')} }}`;
  checkStyleBinding(binding);
  return binding;
}

/** Emission gate: style objects are dash-case; no class helpers ride along. */
function checkStyleBinding(binding: string): void {
  const inner = binding.slice('style={{ '.length, -' }}'.length);
  for (const part of splitTopLevel(inner)) {
    const m = /^\s*(?:"([^"]+)"|\.\.\.)/.exec(part);
    if (m === null) continue;
    const key = m[1];
    if (key === undefined) continue;
    invariant(
      /^[a-z-]+[a-z]$/.test(key) || key.startsWith('-'),
      `style key must be dash-case CSS: ${key}`
    );
  }
}

/** Object-literal expr → property list; otherwise spread into the style object. */
function solidStyleMerge(expr: string): string {
  const trimmed = expr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    return inner.length > 0 ? inner : '';
  }
  return `...((${expr}) ?? {})`;
}

/**
 * Solid `class` / `classList` emission lives in `transform-class-peel.ts`
 * (peels joinClass/cn/… so banned helpers never appear in output).
 */

/** Emit frameClass / enterClass / … (+ ClassList / Style) for one prefixed slot. */
function prefixedSlotAttrs(slot: PrefixedSlot): string[] {
  const classAttr = `${slot.prefix}Class`;
  const classListAttr = `${slot.prefix}ClassList`;
  const styleAttr = `${slot.prefix}Style`;
  const out: string[] = [];
  if (slot.classes.length > 0) {
    const deduped = slot.classes.filter(
      (c, i) => slot.classes.indexOf(c) === i
    );
    out.push(`${classAttr}=${quoteAttr(deduped.join(' '))}`);
  }
  if (slot.classList.length > 0) {
    const parts = slot.classList.map((e) => {
      if ('keyExpr' in e) return `[${e.keyExpr}]: ${e.when}`;
      return `${JSON.stringify(e.className)}: ${e.when}`;
    });
    out.push(`${classListAttr}={{ ${parts.join(', ')} }}`);
  }
  const style = styleBinding(slot.styles, slot.styleExprs);
  if (style !== undefined) {
    out.push(style.replace(/^style=/, `${styleAttr}=`));
  }
  return out;
}

/** Passthrough attribute slices in original order (drops excluded). */
function passthroughAttrs(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  dropAttrs: readonly string[],
  dropSpreads: readonly string[]
): string[] {
  const out: string[] = [];
  for (const prop of element.attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) {
      const text = prop.getText(source);
      if (dropSpreads.includes(text)) continue;
      out.push(text);
      continue;
    }
    if (dropAttrs.includes(prop.name.getText())) continue;
    out.push(prop.getText(source));
  }
  return out;
}

function buildOpeningTag(args: {
  conversion: ComponentConversion;
  element: ts.JsxOpeningLikeElement;
  source: ts.SourceFile;
  isSelfClosing: boolean;
}): string {
  const { conversion, element, source, isSelfClosing } = args;
  const allowEmpty = conversion.allowEmptyClass === true;
  if (!allowEmpty) {
    invariant(conversion.classes.length > 0, 'converted node lost its classes');
  }
  const parts = [`<${conversion.element}`];
  const existing: ExistingClass = conversion.existingClass ?? {
    kind: 'absent',
  };
  parts.push(
    ...classAttrs(conversion.classes, existing, conversion.classList, {
      allowEmpty,
    })
  );
  const style = styleBinding(conversion.styles, conversion.styleExprs);
  if (style !== undefined) parts.push(style);
  for (const slot of conversion.prefixedSlots ?? []) {
    parts.push(...prefixedSlotAttrs(slot));
  }
  for (const key of Object.keys(conversion.dataAttrs)) {
    parts.push(`${key}=${quoteAttr(conversion.dataAttrs[key] ?? '')}`);
  }
  parts.push(...conversion.dataAttrExprs);
  if (conversion.dataAttrsSpread !== undefined) {
    parts.push(conversion.dataAttrsSpread);
  }
  parts.push(...conversion.extraAttrs);
  parts.push(
    ...passthroughAttrs(
      element,
      source,
      conversion.dropAttrs,
      conversion.dropSpreadTexts
    )
  );
  const label = conversion.labelAsChildren;
  if (label !== undefined && isSelfClosing) {
    return `${parts.join(' ')}>{${label}}</${conversion.element}>`;
  }
  const tag = `${parts.join(' ')}${isSelfClosing ? ' />' : '>'}`;
  checkConvertedTag(tag, conversion.element, allowEmpty);
  return tag;
}

/**
 * Tiger gate on every emitted tag: peeled intrinsics always keep `class`;
 * hosts may use frameClass / enterClass / … instead. No sx-family leaks.
 */
function checkConvertedTag(
  tag: string,
  element: string,
  allowEmptyClass: boolean
): void {
  nonEmptyString(element, 'converted element name');
  const intrinsic = /^[a-z][a-z0-9-]*$/.test(element);
  const host = /^[A-Z][A-Za-z0-9]*$/.test(element);
  invariant(intrinsic || host, `bad element name ${element}`);
  if (allowEmptyClass) {
    const hasStyleSurface =
      tag.includes('class=') ||
      /[A-Za-z]Class=/.test(tag) ||
      /[A-Za-z]ClassList=/.test(tag) ||
      /[A-Za-z]Style=/.test(tag) ||
      /[A-Za-z]StyleList=/.test(tag) ||
      tag.includes('style=');
    invariant(hasStyleSurface, 'converted host lost style attrs');
  } else {
    invariant(tag.includes('class='), 'converted tag lost its class');
  }
  invariant(
    !/\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass|sxStyle)\b/.test(
      tag
    ),
    'converted tag must not use class helpers or sxStyle'
  );
  invariant(!/[\s{]sx=\{/.test(tag), 'converted tag leaks sx');
  invariant(!/[\s{]sx="/.test(tag), 'converted tag leaks sx string');
  invariant(!/frameSx=/.test(tag), 'converted tag leaks frameSx');
  invariant(!/enterSx=/.test(tag), 'converted tag leaks enterSx');
  invariant(!/exitSx=/.test(tag), 'converted tag leaks exitSx');
  invariant(!/fieldSx=/.test(tag), 'converted tag leaks fieldSx');
  invariant(!/[\s{]dataSet=/.test(tag), 'converted tag leaks dataSet');
}

function childrenSlice(
  node: PendingNode,
  text: string
): { readonly start: number; readonly end: number; readonly text: string } {
  const openEnd = node.element.end;
  const closeStart = node.closeTag?.getStart() ?? openEnd;
  return {
    start: openEnd,
    end: closeStart,
    text: text.slice(openEnd, closeStart),
  };
}

function applyLabelEdit(args: {
  conversion: ComponentConversion;
  node: PendingNode;
  text: string;
}): SpanEdit | undefined {
  const { conversion, node, text } = args;
  const label = conversion.labelAsChildren;
  if (label === undefined || node.isSelfClosing) return undefined;
  const slice = childrenSlice(node, text);
  if (slice.text.trim() === '') {
    return { start: slice.start, end: slice.end, text: `{${label}}` };
  }
  return {
    start: slice.start,
    end: slice.end,
    text: `{(${label}) ?? (<>${slice.text}</>)}`,
  };
}

type NodeOutcome = {
  readonly edits: readonly SpanEdit[];
  readonly converted?: ConvertedNode | undefined;
  readonly removedLocal?: string | undefined;
};

function convertNode(
  node: PendingNode,
  source: ts.SourceFile,
  text: string
): NodeOutcome {
  if (!isConvertibleExport(node.exportName)) return { edits: [] };
  const at = lineOf(source, node.element.getStart());
  const conversion = convertComponent(node.exportName, node.element, source);
  if (conversion === undefined) return { edits: [] };
  return convertedOutcome({ node, source, text, line: at, conversion });
}

function convertedOutcome(args: {
  node: PendingNode;
  source: ts.SourceFile;
  text: string;
  line: number;
  conversion: ComponentConversion;
}): NodeOutcome {
  const { node, source, text, line, conversion } = args;
  const edits: SpanEdit[] = [
    {
      start: node.element.getStart(),
      end: node.element.end,
      text: buildOpeningTag({
        conversion,
        element: node.element,
        source,
        isSelfClosing: node.isSelfClosing,
      }),
    },
  ];
  if (!node.isSelfClosing && node.closeTag !== undefined) {
    edits.push({
      start: node.closeTag.getStart(),
      end: node.closeTag.end,
      text: `</${conversion.element}>`,
    });
  }
  const labelEdit = applyLabelEdit({ conversion, node, text });
  if (labelEdit !== undefined) edits.push(labelEdit);
  const local = tagName(node.element) ?? '';
  return {
    edits,
    converted: { line, component: node.exportName, tier: conversion.tier },
    removedLocal: conversion.keepImport === true ? undefined : local,
  };
}

/** Validate + prune the edited text. Returns original on any failure. */
function finalizeFile(args: {
  path: string;
  text: string;
  next: string;
  converted: readonly ConvertedNode[];
  removedLocals: readonly string[];
}): FileResult {
  const { path, text, next, converted, removedLocals } = args;
  const fileName = fileNameOf(path);
  if (syntaxErrors(parse(next, fileName)) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: 'output does not parse — left untouched',
    };
  }
  const withRuntime = ensureRuntimeImports(next, path);
  const pruned = pruneImports(
    withRuntime,
    [...removedLocals, ...CLASS_HELPER_NAMES],
    fileName
  );
  if (syntaxErrors(parse(pruned, fileName)) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: 'import pruning broke the output — left untouched',
    };
  }
  invariant(
    converted.length === 0 || pruned !== text,
    'conversions applied but output is identical'
  );
  return {
    text: pruned,
    changed: pruned !== text,
    converted,
    manual: [],
  };
}

type PassAccum = {
  fileName: string;
  text: string;
  converted: ConvertedNode[];
  removedLocals: string[];
};

/** Convert leaf nodes only; returns whether any conversion edits applied. */
function convertLeavesPass(accum: PassAccum): boolean {
  const source = parse(accum.text, accum.fileName);
  if (syntaxErrors(source) > 0) return false;
  const nodes = collectNodes(source, resolveBindings(source));
  const leaves = nodes.filter((n) => isLeafNode(n, nodes));
  const edits: SpanEdit[] = [];
  for (const node of leaves) {
    const outcome = convertNode(node, source, accum.text);
    if (outcome.converted === undefined) continue;
    edits.push(...outcome.edits);
    accum.converted.push(outcome.converted);
    if (outcome.removedLocal !== undefined && outcome.removedLocal !== '') {
      accum.removedLocals.push(outcome.removedLocal);
    }
  }
  if (edits.length === 0) return false;
  accum.text = applyEdits(accum.text, edits);
  return true;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Main entry: transform one file's text. Never throws on bad input. */
export function transformFile(path: string, text: string): FileResult {
  try {
    return transformFileInner(path, text);
  } catch (error) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: `transform failed: ${errorMessage(error)}`,
    };
  }
}

function transformFileInner(path: string, text: string): FileResult {
  const fileName =
    path.endsWith('.tsx') || path.endsWith('.ts')
      ? fileNameOf(path)
      : 'file.tsx';
  const source = parse(text, fileName);
  if (syntaxErrors(source) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: 'input does not parse',
    };
  }
  const accum: PassAccum = {
    fileName,
    text,
    converted: [],
    removedLocals: [],
  };
  for (let pass = 0; pass < MAX_CONVERT_PASSES; pass++) {
    if (!convertLeavesPass(accum)) break;
    if (syntaxErrors(parse(accum.text, fileName)) > 0) {
      return {
        text,
        changed: false,
        converted: [],
        manual: [],
        parseError: 'output does not parse — left untouched',
      };
    }
  }
  const afterConvert = parse(accum.text, fileName);
  if (syntaxErrors(afterConvert) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: 'output does not parse — left untouched',
    };
  }
  if (hasConvertibleLeftovers(afterConvert, accum.text)) {
    return {
      text,
      changed: false,
      converted: [],
      manual: [],
      parseError: 'nested conversion did not fixpoint — left untouched',
    };
  }
  // Peel leftover `class={joinClass(...)}` on hosts/intrinsics and rewrite
  // non-attribute helper calls so banned names never survive a pass.
  const purged = purgeClassHelpers(path, accum.text);
  if (accum.converted.length === 0 && purged === text) {
    return { text, changed: false, converted: [], manual: [] };
  }
  return finalizeFile({
    path,
    text,
    next: purged,
    converted: accum.converted,
    removedLocals: accum.removedLocals,
  });
}

/** True when a convertible leaf would still convert (pass cap exhausted). */
function hasConvertibleLeftovers(source: ts.SourceFile, text: string): boolean {
  const nodes = collectNodes(source, resolveBindings(source));
  const leaves = nodes.filter((n) => isLeafNode(n, nodes));
  for (const node of leaves) {
    if (!isConvertibleExport(node.exportName)) continue;
    if (convertNode(node, source, text).converted !== undefined) return true;
  }
  return false;
}
