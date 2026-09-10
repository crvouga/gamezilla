/**
 * File-level purge of banned class-merge helpers after JSX peeling.
 *
 * 1. Rewrite any remaining `class={joinClass(...)}` / `cn(...)` on *any*
 *    JSX element (intrinsic or host) into Solid `class` + `classList`.
 * 2. Rewrite leftover non-attribute `joinClass(...)` calls to a filter+join
 *    expression so the banned identifier disappears from the file.
 */

import ts from 'typescript';
import {
  CLASS_HELPER_NAMES,
  classAttrs,
  peelClassHelperCall,
} from './transform-class-peel';
import {
  applyEdits,
  parse,
  pruneImports,
  type SpanEdit,
  syntaxErrors,
} from './transform-imports';
import { getJsxAttr } from './transform-attrs';
import type { ExistingClass } from './transform-node';

const HELPER_NAME = new Set(CLASS_HELPER_NAMES);

/** True when `expr` is a banned class-helper call. */
function isHelperCall(expr: ts.Expression): boolean {
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  return ts.isIdentifier(callee) && HELPER_NAME.has(callee.text);
}

function attrName(attr: ts.JsxAttribute): string | undefined {
  if (ts.isIdentifier(attr.name)) return attr.name.text;
  return undefined;
}

/**
 * Read an existing `classList={…}` so peels can merge rather than duplicate.
 * Returns the inner object/expression text, or undefined when absent.
 */
function readClassListMerge(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): { readonly exprText: string; readonly attr: ts.JsxAttribute } | undefined {
  const attr = getJsxAttr(element, 'classList');
  if (attr === undefined || attr.initializer === undefined) return undefined;
  if (!ts.isJsxExpression(attr.initializer)) return undefined;
  const expr = attr.initializer.expression;
  if (expr === undefined) return undefined;
  return { exprText: expr.getText(source), attr };
}

/** Build replacement attrs for a helper-backed `class={…}`. */
function peelClassAttr(args: {
  classAttr: ts.JsxAttribute;
  element: ts.JsxOpeningLikeElement;
  source: ts.SourceFile;
}): SpanEdit[] | undefined {
  const { classAttr, element, source } = args;
  if (classAttr.initializer === undefined) return undefined;
  if (!ts.isJsxExpression(classAttr.initializer)) return undefined;
  const expr = classAttr.initializer.expression;
  if (expr === undefined || !isHelperCall(expr)) return undefined;
  const existing: ExistingClass = {
    kind: 'expr',
    exprText: expr.getText(source),
  };
  const merge = readClassListMerge(element, source);
  const entries = classAttrs([], existing, [], { allowEmpty: true });
  if (merge === undefined) {
    return [
      {
        start: classAttr.getStart(source),
        end: classAttr.end,
        text: entries.join(' '),
      },
    ];
  }
  return mergeWithExistingClassList({
    classAttr,
    merge,
    entries,
    source,
  });
}

/** Fold peeled entries into an existing `classList={expr}` (spread). */
function mergeWithExistingClassList(args: {
  classAttr: ts.JsxAttribute;
  merge: { readonly exprText: string; readonly attr: ts.JsxAttribute };
  entries: readonly string[];
  source: ts.SourceFile;
}): SpanEdit[] {
  const { classAttr, merge, entries, source } = args;
  const classPart = entries.find((e) => e.startsWith('class='));
  const listPart = entries.find((e) => e.startsWith('classList='));
  // No peeled toggles — keep the existing classList attr as-is.
  if (listPart === undefined) {
    return [
      {
        start: classAttr.getStart(source),
        end: classAttr.end,
        text: classPart ?? '',
      },
    ];
  }
  const peeledInner = listPart.slice(
    'classList={{ '.length,
    -' }}'.length
  );
  const mergedList = `classList={{ ${peeledInner}, ...(${merge.exprText}) }}`;
  const replacement =
    classPart === undefined ? mergedList : `${classPart} ${mergedList}`;
  return [
    {
      start: classAttr.getStart(source),
      end: classAttr.end,
      text: replacement,
    },
    { start: merge.attr.getStart(source), end: merge.attr.end, text: '' },
  ];
}

function collectClassAttrEdits(
  source: ts.SourceFile
): readonly SpanEdit[] {
  const edits: SpanEdit[] = [];
  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const classAttr = getJsxAttr(node, 'class');
      if (classAttr !== undefined) {
        const peeled = peelClassAttr({
          classAttr,
          element: node,
          source,
        });
        if (peeled !== undefined) edits.push(...peeled);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return edits;
}

/**
 * Rewrite a non-attribute helper call to a filter+join expression.
 * `joinClass('a', cond && 'b', x)` → `['a', cond && 'b', x].filter(Boolean).join(' ')`
 */
function rewriteHelperCallExpr(
  call: ts.CallExpression,
  source: ts.SourceFile
): SpanEdit {
  const args = call.arguments.map((a) => a.getText(source));
  const array = `[${args.join(', ')}]`;
  return {
    start: call.getStart(source),
    end: call.end,
    text: `${array}.filter(Boolean).join(' ')`,
  };
}

function collectHelperCallEdits(
  source: ts.SourceFile
): readonly SpanEdit[] {
  const edits: SpanEdit[] = [];
  function visit(node: ts.Node): void {
    // Skip the function *declaration* `function joinClass(...)` itself.
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      if (HELPER_NAME.has(node.name.text)) {
        ts.forEachChild(node, visit);
        return;
      }
    }
    if (ts.isCallExpression(node) && isHelperCall(node)) {
      // Skip calls that are still JSX class attrs — those are peeled above.
      if (!isJsxClassAttrValue(node)) {
        edits.push(rewriteHelperCallExpr(node, source));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return edits;
}

/** True when this call is the direct value of a JSX `class={…}` attr. */
function isJsxClassAttrValue(call: ts.CallExpression): boolean {
  let parent: ts.Node | undefined = call.parent;
  while (parent !== undefined && ts.isParenthesizedExpression(parent)) {
    parent = parent.parent;
  }
  if (parent === undefined || !ts.isJsxExpression(parent)) return false;
  const attr = parent.parent;
  if (attr === undefined || !ts.isJsxAttribute(attr)) return false;
  return attrName(attr) === 'class';
}

/**
 * Purge banned helpers from a file: peel JSX class attrs, rewrite leftover
 * calls, prune imports. Returns original text when nothing changes / parse fails.
 */
export function purgeClassHelpers(path: string, text: string): string {
  const fileName = path.endsWith('.ts') && !path.endsWith('.tsx')
    ? path.split('/').pop() ?? 'file.ts'
    : path.split('/').pop() ?? 'file.tsx';
  let next = text;
  const source1 = parse(next, fileName);
  if (syntaxErrors(source1) > 0) return text;
  const attrEdits = collectClassAttrEdits(source1);
  if (attrEdits.length > 0) next = applyEdits(next, attrEdits);
  const source2 = parse(next, fileName);
  if (syntaxErrors(source2) > 0) return text;
  const callEdits = collectHelperCallEdits(source2);
  if (callEdits.length > 0) next = applyEdits(next, callEdits);
  if (next === text) return text;
  const pruned = pruneImports(next, [...CLASS_HELPER_NAMES], fileName);
  if (syntaxErrors(parse(pruned, fileName)) > 0) return text;
  return pruned;
}

/** Re-export for tests that want to assert peel shapes without a full file. */
export { peelClassHelperCall };
