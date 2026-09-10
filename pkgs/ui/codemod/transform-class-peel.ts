/**
 * Peel banned class-merge helpers (`joinClass` / `cn` / …) into Solid
 * `classList` entries so converted tags never retain helper calls.
 */

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

/**
 * Solid `class` (static) + optional `classList` (conditional / dynamic).
 * Existing `class={joinClass(...)}` / `cn(...)` / … calls are peeled into
 * per-arg `classList` entries so banned helpers never appear in output.
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
  const deduped = merged.filter((c, i) => merged.indexOf(c) === i);
  const entries = [...classList];
  if (existing.kind === 'expr') {
    const peeled = peelClassHelperCall(existing.exprText);
    if (peeled !== undefined) {
      for (const arg of peeled) {
        // A literal already emitted as a static class must not repeat in
        // classList (it would be toggled on unconditionally).
        const literal = arg.match(/^'([^']*)'$|^"([^"]*)"$/);
        const literalClass = literal?.[1] ?? literal?.[2];
        if (literalClass !== undefined && deduped.includes(literalClass)) {
          continue;
        }
        entries.push({ keyExpr: arg, when: `!!(${arg})` });
      }
    } else {
      entries.push({
        keyExpr: existing.exprText,
        when: `!!(${existing.exprText})`,
      });
    }
  }
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
