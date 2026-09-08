/**
 * File-level text utilities for the codemod: parse, span edits, import
 * pruning, and `cn`/`cnStyle` import injection.
 *
 * Pure (string in, string out). Split from `transform.ts` so neither file
 * trips the structural size caps.
 */

import ts from 'typescript';
import { invariant, nonEmptyString } from './tiger';

export type SpanEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

export function parse(text: string): ts.SourceFile {
  return ts.createSourceFile(
    'file.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

/** Syntax error count (`parseDiagnostics` is untyped on the public AST). */
export function syntaxErrors(source: ts.SourceFile): number {
  const withDiagnostics = source as unknown as {
    parseDiagnostics?: readonly unknown[] | undefined;
  };
  return withDiagnostics.parseDiagnostics?.length ?? 0;
}

export function applyEdits(text: string, edits: readonly SpanEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 0; i < sorted.length; i++) {
    const edit = sorted[i];
    invariant(
      edit !== undefined && edit.start <= edit.end,
      'edit span is inverted'
    );
    const next = sorted[i + 1];
    if (next !== undefined && edit !== undefined) {
      invariant(next.end <= edit.start, 'edits overlap — refusing to corrupt');
    }
  }
  let out = text;
  for (const edit of sorted) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

/** Remove import specifiers whose local names no longer occur. */
export function pruneImports(text: string, removed: readonly string[]): string {
  if (removed.length === 0) return text;
  for (const name of removed) nonEmptyString(name, 'pruned import name');
  const source = parse(text);
  const edits: SpanEdit[] = [];
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const module = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(module) || module.text !== '@pkgs/ui') continue;
    const clause = stmt.importClause;
    if (clause?.namedBindings === undefined) continue;
    if (!ts.isNamedImports(clause.namedBindings)) continue;
    const kept = clause.namedBindings.elements.filter(
      (el) =>
        !removed.includes(el.name.text) || stillUsed(source, stmt, el.name.text)
    );
    if (kept.length === clause.namedBindings.elements.length) continue;
    if (kept.length === 0) {
      const end = text[stmt.end] === '\n' ? stmt.end + 1 : stmt.end;
      edits.push({ start: stmt.getStart(), end, text: '' });
      continue;
    }
    const names = kept.map((el) =>
      el.propertyName === undefined
        ? el.name.text
        : `${el.propertyName.text} as ${el.name.text}`
    );
    edits.push({
      start: clause.namedBindings.getStart(),
      end: clause.namedBindings.end,
      text: `{ ${names.join(', ')} }`,
    });
  }
  return applyEdits(text, edits);
}

function stillUsed(
  source: ts.SourceFile,
  importStmt: ts.ImportDeclaration,
  name: string
): boolean {
  let used = false;
  function visit(node: ts.Node): void {
    if (node === importStmt) return;
    if (ts.isIdentifier(node) && node.text === name) used = true;
    if (!used) ts.forEachChild(node, visit);
  }
  ts.forEachChild(source, visit);
  return used;
}

/** Add `cn`/`cnStyle` to the `@pkgs/ui` import when the output calls them. */
export function ensureRuntimeImports(text: string): string {
  const needsCn = /\bcn\(/.test(text);
  const needsCnStyle = /\bcnStyle\(/.test(text);
  if (!needsCn && !needsCnStyle) return text;
  const wanted = [
    ...(needsCn ? ['cn'] : []),
    ...(needsCnStyle ? ['cnStyle'] : []),
  ];
  const source = parse(text);
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const module = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(module) || module.text !== '@pkgs/ui') continue;
    const clause = stmt.importClause;
    if (clause?.namedBindings === undefined) continue;
    if (!ts.isNamedImports(clause.namedBindings)) continue;
    const have = new Set(
      clause.namedBindings.elements.map((el) => el.name.text)
    );
    const missing = wanted.filter((w) => !have.has(w));
    if (missing.length === 0) return text;
    const names = [
      ...clause.namedBindings.elements.map((el) =>
        el.propertyName === undefined
          ? el.name.text
          : `${el.propertyName.text} as ${el.name.text}`
      ),
      ...missing,
    ];
    const edit: SpanEdit = {
      start: clause.namedBindings.getStart(),
      end: clause.namedBindings.end,
      text: `{ ${names.join(', ')} }`,
    };
    return applyEdits(text, [edit]);
  }
  const anchor = lastImportEnd(source);
  const line = `import { ${wanted.join(', ')} } from '@pkgs/ui';\n`;
  if (anchor === 0) return line + text;
  return `${text.slice(0, anchor)}\n${line}${text.slice(anchor)}`;
}

function lastImportEnd(source: ts.SourceFile): number {
  let end = 0;
  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt)) end = stmt.end;
  }
  return end;
}
