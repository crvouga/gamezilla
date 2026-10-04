/**
 * Peel banned class-merge helpers (`joinClass` / `cn` / …) into Solid
 * `classList` entries so converted tags never retain helper calls.
 */

import ts from 'typescript';
import { splitTopLevel } from './split-top-level';
import type { ClassListEntry, ExistingClass } from './transform-node';

const CLASS_HELPER_CALL =
  /^(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass)\s*\(/;

/** Names pruned from imports when unused after conversion. */
export const CLASS_HELPER_NAMES: readonly string[] = [
  'cn',
  'clsx',
  'classnames',
  'twMerge',
  'twJoin',
  'cx',
  'cva',
  'joinClass',
  'sxStyle',
];

function quoteAttr(value: string): string {
  return `"${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
}

/** A single `class` / helper-arg expression, classified for emission. */
type ClassArg =
  | { readonly kind: 'static'; readonly value: string }
  | {
      readonly kind: 'ternary';
      readonly whenTrue: string;
      readonly whenFalse: string;
      readonly condition: string;
    }
  | {
      readonly kind: 'toggle';
      readonly className: string;
      readonly condition: string;
    }
  /** Any other string-ish expression; emitted into `class={…}` (not classList). */
  | { readonly kind: 'dynamic'; readonly expr: string };

/** Parse one arg text (helper arg / `class` expression) into a ClassArg. */
function classifyClassArg(text: string): ClassArg {
  const trimmed = text.trim();
  const file = ts.createSourceFile(
    'class-arg.tsx',
    `(${trimmed})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const stmt = file.statements[0];
  if (stmt === undefined || !ts.isExpressionStatement(stmt)) {
    return { kind: 'dynamic', expr: trimmed };
  }
  let expr = stmt.expression;
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  const literal = stringLiteralOf(expr);
  if (literal !== undefined) return { kind: 'static', value: literal };
  if (ts.isConditionalExpression(expr)) {
    const whenTrue = stringLiteralOf(unwrap(expr.whenTrue));
    const whenFalse = stringLiteralOf(unwrap(expr.whenFalse));
    // Both branches must be literals to split into two toggles; otherwise
    // fall through to the String(...) dynamic path.
    if (whenTrue !== undefined && whenFalse !== undefined) {
      return {
        kind: 'ternary',
        whenTrue,
        whenFalse,
        condition: expr.condition.getText(file),
      };
    }
  }
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    const className = stringLiteralOf(unwrap(expr.right));
    if (className !== undefined) {
      return {
        kind: 'toggle',
        className,
        condition: expr.left.getText(file),
      };
    }
  }
  return { kind: 'dynamic', expr: trimmed };
}

function unwrap(expr: ts.Expression): ts.Expression {
  let node = expr;
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

function stringLiteralOf(expr: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  return undefined;
}

type PeeledClassParts = {
  readonly staticClasses: string[];
  readonly entries: ClassListEntry[];
  readonly dynamicExprs: string[];
};

function applyClassifiedArg(
  classified: ClassArg,
  parts: PeeledClassParts
): void {
  if (classified.kind === 'static') {
    parts.staticClasses.push(classified.value);
    return;
  }
  if (classified.kind === 'ternary') {
    parts.entries.push({
      className: classified.whenTrue,
      when: `!!(${classified.condition})`,
    });
    parts.entries.push({
      className: classified.whenFalse,
      when: `!(${classified.condition})`,
    });
    return;
  }
  if (classified.kind === 'toggle') {
    parts.entries.push({
      className: classified.className,
      when: `!!(${classified.condition})`,
    });
    return;
  }
  parts.dynamicExprs.push(classified.expr);
}

function peelExistingClass(
  existing: ExistingClass,
  classList: readonly ClassListEntry[]
): PeeledClassParts {
  const parts: PeeledClassParts = {
    staticClasses: [],
    entries: [...classList],
    dynamicExprs: [],
  };
  if (existing.kind === 'literal' && existing.value !== '') {
    parts.staticClasses.push(existing.value);
  }
  if (existing.kind !== 'expr') return parts;
  const peeled = peelClassHelperCall(existing.exprText);
  for (const arg of peeled ?? [existing.exprText]) {
    applyClassifiedArg(classifyClassArg(arg), parts);
  }
  return parts;
}

function emitClassAttr(
  deduped: readonly string[],
  dynamicExprs: readonly string[],
  allowEmpty: boolean
): string | undefined {
  if (dynamicExprs.length === 0) {
    if (deduped.length === 0 && allowEmpty) return undefined;
    return `class=${quoteAttr(deduped.join(' '))}`;
  }
  if (deduped.length === 0 && dynamicExprs.length === 1) {
    return `class={${dynamicExprs[0]}}`;
  }
  const parts = [
    ...(deduped.length > 0 ? [JSON.stringify(deduped.join(' '))] : []),
    ...dynamicExprs,
  ];
  return `class={[${parts.join(', ')}].filter(Boolean).join(' ')}`;
}

function emitClassListAttr(entries: readonly ClassListEntry[]): string {
  const parts = entries.map((e) => {
    if ('keyExpr' in e) return `[${e.keyExpr}]: ${e.when}`;
    return `${JSON.stringify(e.className)}: ${e.when}`;
  });
  return `classList={{ ${parts.join(', ')} }}`;
}

/**
 * Solid `class` (static + dynamic exprs) + optional `classList` (toggles).
 * Existing `class={joinClass(...)}` / `cn(...)` / … calls are peeled into
 * static classes / per-arg `classList` entries so banned helpers never appear.
 *
 * Emission rules:
 * - string literals fold into the static `class` attribute (deduped);
 * - `cond && 'x'` / `cond ? 'x' : 'y'` become `'x': !!cond` toggles;
 * - any other string-valued expression is concatenated into `class={…}`
 *   (never `[String(expr)]: true` — multi-token strings are invalid classList keys).
 */
export function classAttrs(
  classes: readonly string[],
  existing: ExistingClass,
  classList: readonly ClassListEntry[],
  options?: { readonly allowEmpty?: boolean | undefined }
): string[] {
  const peeled = peelExistingClass(existing, classList);
  const merged = [...classes, ...peeled.staticClasses];
  const deduped = merged.filter(
    (c, i) => c.trim() !== '' && merged.indexOf(c) === i
  );
  const out: string[] = [];
  const classAttr = emitClassAttr(
    deduped,
    peeled.dynamicExprs,
    options?.allowEmpty === true
  );
  if (classAttr !== undefined) out.push(classAttr);
  if (peeled.entries.length > 0) {
    out.push(emitClassListAttr(peeled.entries));
  }
  return out;
}

/** Split top-level args of a class-helper call; undefined if not a helper call. */
export function peelClassHelperCall(
  exprText: string
): readonly string[] | undefined {
  const trimmed = exprText.trim();
  if (!CLASS_HELPER_CALL.test(trimmed) || !trimmed.endsWith(')')) {
    return undefined;
  }
  const open = trimmed.indexOf('(');
  const inner = trimmed.slice(open + 1, -1).trim();
  if (inner.length === 0) return [];
  return splitTopLevel(inner)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}
