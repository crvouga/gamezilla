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
  /** Any other string-ish expression; emitted as `[String(expr)]: true`. */
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

/**
 * Solid `class` (static) + optional `classList` (conditional / dynamic).
 * Existing `class={joinClass(...)}` / `cn(...)` / … calls are peeled into
 * static classes / per-arg `classList` entries so banned helpers never appear.
 *
 * Emission rules (Solid's `classList` only accepts string keys + boolean
 * values):
 * - string literals fold into the static `class` attribute (deduped);
 * - `cond && 'x'` / `cond ? 'x' : 'y'` become `'x': !!cond` toggles;
 * - any other string-valued expression becomes a computed key
 *   `[String(expr)]: true` (Solid skips empty keys), which keeps
 *   type-checking valid for `string | undefined | false` unions.
 */
export function classAttrs(
  classes: readonly string[],
  existing: ExistingClass,
  classList: readonly ClassListEntry[],
  options?: { readonly allowEmpty?: boolean | undefined }
): string[] {
  const merged = [...classes];
  if (existing.kind === 'literal' && existing.value !== '') {
    merged.push(existing.value);
  }
  const entries = [...classList];
  if (existing.kind === 'expr') {
    const peeled = peelClassHelperCall(existing.exprText);
    const args = peeled ?? [existing.exprText];
    for (const arg of args) {
      const classified = classifyClassArg(arg);
      if (classified.kind === 'static') {
        merged.push(classified.value);
        continue;
      }
      if (classified.kind === 'ternary') {
        entries.push({
          className: classified.whenTrue,
          when: `!!(${classified.condition})`,
        });
        entries.push({
          className: classified.whenFalse,
          when: `!(${classified.condition})`,
        });
        continue;
      }
      if (classified.kind === 'toggle') {
        entries.push({
          className: classified.className,
          when: `!!(${classified.condition})`,
        });
        continue;
      }
      entries.push({ keyExpr: `String(${classified.expr})`, when: 'true' });
    }
  }
  const deduped = merged.filter(
    (c, i) => c.trim() !== '' && merged.indexOf(c) === i
  );
  const out: string[] = [];
  if (deduped.length > 0 || options?.allowEmpty !== true) {
    out.push(`class=${quoteAttr(deduped.join(' '))}`);
  }
  if (entries.length === 0) return out;
  const parts = entries.map((e) => {
    if ('keyExpr' in e) return `[${e.keyExpr}]: ${e.when}`;
    return `${JSON.stringify(e.className)}: ${e.when}`;
  });
  out.push(`classList={{ ${parts.join(', ')} }}`);
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
