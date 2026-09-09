/**
 * File-level transform: parse → convert each primitive usage via span edits
 * → re-parse to prove validity → prune unused primitive imports.
 *
 * Pure (string in, string out). Spread attributes (`{...rest}`) force Tier C:
 * a spread may carry `sx`/`dataSet` invisibly, and converting would leak
 * those props onto a plain element.
 *
 * Nested JSX is converted leaf-first across passes so parent label/children
 * edits never overlap descendant tag edits (which would throw in applyEdits).
 * Invariant failures become file-level `parseError` results — never throws.
 */

import ts from 'typescript';
import { invariant, nonEmptyString } from './tiger';
import {
  carriesSx,
  collectNodes,
  hasSpread,
  isLeafNode,
  lineOf,
  type PendingNode,
  resolveBindings,
  tagName,
} from './transform-collect';
import {
  CONVERTIBLE,
  type ComponentConversion,
  convertComponent,
} from './transform-components';
import {
  applyEdits,
  ensureRuntimeImports,
  parse,
  pruneImports,
  type SpanEdit,
  syntaxErrors,
} from './transform-imports';
import type { ExistingClass } from './transform-node';

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
  readonly manual: readonly ManualNode[];
  readonly parseError?: string | undefined;
};

const TODO_MARKER = 'TODO(sx-codemod)';
const MAX_CONVERT_PASSES = 64;

/** Escape a static string into a double-quoted JSX attribute value. */
function quoteAttr(value: string): string {
  return `"${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
}

function styleBinding(
  styles: readonly { cssProp: string; exprText: string; wrap: string }[],
  cnExprs: readonly string[]
): string | undefined {
  if (styles.length === 0 && cnExprs.length === 0) return undefined;
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
  if (cnExprs.length === 0) {
    invariant(parts.length > 0, 'styleBinding needs at least one entry');
    return `style={{ ${parts.join(', ')} }}`;
  }
  const spread = `...cnStyle(${cnExprs.join(', ')})`;
  return `style={{ ${[spread, ...parts].join(', ')} }}`;
}

function classAttr(
  classes: readonly string[],
  existing: ExistingClass,
  cnExprs: readonly string[]
): string {
  const merged = [...classes];
  if (existing.kind === 'literal' && existing.value !== '') {
    merged.push(existing.value);
  }
  const deduped = merged.filter((c, i) => merged.indexOf(c) === i);
  const staticPart = deduped.join(' ');
  if (cnExprs.length === 0) {
    if (existing.kind === 'expr') {
      return `class={\`${staticPart} \${${existing.exprText}}\`}`;
    }
    return `class=${quoteAttr(staticPart)}`;
  }
  const args = [JSON.stringify(staticPart), ...cnExprs];
  if (existing.kind === 'expr') args.push(existing.exprText);
  return `class={cn(${args.join(', ')})}`;
}

/** Passthrough attribute slices in original order (drops excluded). */
function passthroughAttrs(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  dropAttrs: readonly string[]
): string[] {
  const out: string[] = [];
  for (const prop of element.attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) {
      out.push(prop.getText(source));
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
  if (conversion.kind === 'manual') return element.getText(source);
  invariant(conversion.classes.length > 0, 'converted node lost its classes');
  const parts = [`<${conversion.element}`];
  const existing: ExistingClass = conversion.existingClass ?? {
    kind: 'absent',
  };
  parts.push(classAttr(conversion.classes, existing, conversion.cnExprs));
  const style = styleBinding(conversion.styles, conversion.cnExprs);
  if (style !== undefined) parts.push(style);
  for (const key of Object.keys(conversion.dataAttrs)) {
    parts.push(`${key}=${quoteAttr(conversion.dataAttrs[key] ?? '')}`);
  }
  parts.push(...conversion.extraAttrs);
  parts.push(...passthroughAttrs(element, source, conversion.dropAttrs));
  const label = conversion.labelAsChildren;
  if (label !== undefined && isSelfClosing) {
    return `${parts.join(' ')}>{${label}}</${conversion.element}>`;
  }
  const tag = `${parts.join(' ')}${isSelfClosing ? ' />' : '>'}`;
  if (conversion.kind === 'converted') {
    checkConvertedTag(tag, conversion.element);
  }
  return tag;
}

/**
 * Tiger gate on every emitted tag: a class is always present (base styles
 * are never dropped) and no `sx`/`frameSx`/`dataSet` leaks onto the plain
 * element. A violation throws instead of writing a subtly broken file.
 */
function checkConvertedTag(tag: string, element: string): void {
  nonEmptyString(element, 'converted element name');
  invariant(/^[a-z][a-z0-9-]*$/.test(element), `bad element name ${element}`);
  invariant(tag.includes('class='), 'converted tag lost its class');
  invariant(!/[\s{]sx=\{/.test(tag), 'converted tag leaks sx');
  invariant(!/[\s{]sx="/.test(tag), 'converted tag leaks sx string');
  invariant(!/frameSx=/.test(tag), 'converted tag leaks frameSx');
  invariant(!/dataSet=/.test(tag), 'converted tag leaks dataSet');
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
  if (conversion.kind === 'manual') return undefined;
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

function todoEdit(
  node: PendingNode,
  text: string,
  reason: string
): SpanEdit | undefined {
  nonEmptyString(reason, 'Tier C reason');
  const start = node.element.getStart();
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const indent = text.slice(lineStart, start).match(/^\s*/)?.[0] ?? '';
  const prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
  const prevLine = text.slice(prevLineStart, lineStart);
  if (prevLine.includes(TODO_MARKER)) return undefined;
  return {
    start: lineStart,
    end: lineStart,
    text: `${indent}// ${TODO_MARKER}: manual — ${reason}\n`,
  };
}

type NodeOutcome = {
  readonly edits: readonly SpanEdit[];
  readonly converted?: ConvertedNode | undefined;
  readonly manual?: ManualNode | undefined;
  readonly removedLocal?: string | undefined;
};

function convertNode(
  node: PendingNode,
  source: ts.SourceFile,
  text: string
): NodeOutcome {
  const at = lineOf(source, node.element.getStart());
  if (hasSpread(node.element)) {
    return spreadOutcome(node, text, at);
  }
  const conversion = convertComponent(node.exportName, node.element, source);
  if (conversion.kind === 'manual') {
    return manualOutcome(node, text, at, conversion.reason);
  }
  return convertedOutcome({ node, source, text, line: at, conversion });
}

function spreadOutcome(
  node: PendingNode,
  text: string,
  line: number
): NodeOutcome {
  const reason = 'spread attributes may carry sx';
  const edit = todoEdit(node, text, reason);
  return {
    edits: edit === undefined ? [] : [edit],
    manual: { line, component: node.exportName, reason },
  };
}

function manualOutcome(
  node: PendingNode,
  text: string,
  line: number,
  reason: string
): NodeOutcome {
  if (!CONVERTIBLE.has(node.exportName) && !carriesSx(node.element)) {
    return { edits: [] };
  }
  const edit = todoEdit(node, text, reason);
  return {
    edits: edit === undefined ? [] : [edit],
    manual: { line, component: node.exportName, reason },
  };
}

function convertedOutcome(args: {
  node: PendingNode;
  source: ts.SourceFile;
  text: string;
  line: number;
  conversion: ComponentConversion;
}): NodeOutcome {
  const { node, source, text, line, conversion } = args;
  if (conversion.kind === 'manual') return { edits: [] };
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
  return {
    edits,
    converted: { line, component: node.exportName, tier: conversion.tier },
    removedLocal: tagName(node.element) ?? '',
  };
}

/** Validate + prune the edited text. Returns original on any failure. */
function finalizeFile(args: {
  text: string;
  next: string;
  converted: readonly ConvertedNode[];
  manual: readonly ManualNode[];
  removedLocals: readonly string[];
}): FileResult {
  const { text, next, converted, manual, removedLocals } = args;
  if (syntaxErrors(parse(next)) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual,
      parseError: 'output does not parse — left untouched',
    };
  }
  const withRuntime = ensureRuntimeImports(next);
  const pruned = pruneImports(withRuntime, removedLocals);
  if (syntaxErrors(parse(pruned)) > 0) {
    return {
      text,
      changed: false,
      converted: [],
      manual,
      parseError: 'import pruning broke the output — left untouched',
    };
  }
  invariant(
    converted.length === 0 || pruned !== text,
    'conversions applied but output is identical'
  );
  return { text: pruned, changed: pruned !== text, converted, manual };
}

type PassAccum = {
  text: string;
  converted: ConvertedNode[];
  removedLocals: string[];
};

/** Convert leaf nodes only; returns whether any conversion edits applied. */
function convertLeavesPass(accum: PassAccum): boolean {
  const source = parse(accum.text);
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

/** Mark remaining Tier C nodes with TODOs after conversions fixpoint. */
function manualPass(text: string): {
  readonly text: string;
  readonly manual: readonly ManualNode[];
} {
  const source = parse(text);
  if (syntaxErrors(source) > 0) return { text, manual: [] };
  const nodes = collectNodes(source, resolveBindings(source));
  const edits: SpanEdit[] = [];
  const manual: ManualNode[] = [];
  for (const node of nodes) {
    const outcome = convertNode(node, source, text);
    if (outcome.manual === undefined) continue;
    manual.push(outcome.manual);
    edits.push(...outcome.edits);
  }
  if (edits.length === 0) return { text, manual };
  return { text: applyEdits(text, edits), manual };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Main entry: transform one file's text. Never throws on bad input. */
export function transformFile(path: string, text: string): FileResult {
  void path;
  try {
    return transformFileInner(text);
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

function transformFileInner(text: string): FileResult {
  const source = parse(text);
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
    text,
    converted: [],
    removedLocals: [],
  };
  for (let pass = 0; pass < MAX_CONVERT_PASSES; pass++) {
    if (!convertLeavesPass(accum)) break;
    if (syntaxErrors(parse(accum.text)) > 0) {
      return {
        text,
        changed: false,
        converted: [],
        manual: [],
        parseError: 'output does not parse — left untouched',
      };
    }
  }
  const afterConvert = parse(accum.text);
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
  const marked = manualPass(accum.text);
  if (accum.converted.length === 0 && marked.text === text) {
    return { text, changed: false, converted: [], manual: marked.manual };
  }
  return finalizeFile({
    text,
    next: marked.text,
    converted: accum.converted,
    manual: marked.manual,
    removedLocals: accum.removedLocals,
  });
}

/** True when a convertible leaf would still convert (pass cap exhausted). */
function hasConvertibleLeftovers(source: ts.SourceFile, text: string): boolean {
  const nodes = collectNodes(source, resolveBindings(source));
  const leaves = nodes.filter((n) => isLeafNode(n, nodes));
  for (const node of leaves) {
    if (!CONVERTIBLE.has(node.exportName)) continue;
    if (convertNode(node, source, text).converted !== undefined) return true;
  }
  return false;
}
