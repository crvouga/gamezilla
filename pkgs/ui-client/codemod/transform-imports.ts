/**
 * File-level text utilities for the codemod: parse, span edits, import
 * pruning, and `dataAttrs` import injection.
 *
 * Pure (string in, string out). Split from `transform.ts` so neither file
 * trips the structural size caps.
 */

import ts from 'typescript';
import { invariant, nonEmptyString } from './tiger';
import { isPrunableModule } from './transform-collect';

export type SpanEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

/**
 * Parse with the right script kind: `.ts` files may contain TSX-invalid
 * constructs (e.g. generic arrow functions `async <T>(…) => …`), which read
 * as JSX under `ScriptKind.TSX` and would false-positive "does not parse".
 */
export function parse(text: string, fileName = 'file.tsx'): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.ts') &&
      !fileName.endsWith('.tsx') &&
      !fileName.endsWith('.d.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.TSX
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
export function pruneImports(
  text: string,
  removed: readonly string[],
  fileName = 'file.tsx'
): string {
  if (removed.length === 0) return text;
  for (const name of removed) nonEmptyString(name, 'pruned import name');
  const source = parse(text, fileName);
  const edits: SpanEdit[] = [];
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const module = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(module) || !isPrunableModule(module.text)) continue;
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
    const names = kept.map((el) => {
      const rename =
        el.propertyName === undefined
          ? el.name.text
          : `${el.propertyName.text} as ${el.name.text}`;
      return el.isTypeOnly === true ? `type ${rename}` : rename;
    });
    edits.push({
      start: clause.getStart(),
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

/** Add `dataAttrs` when the output calls it. */
export function ensureRuntimeImports(text: string, filePath = ''): string {
  const needsDataAttrs = /\bdataAttrs\(/.test(text);
  if (!needsDataAttrs) return text;
  const fileName = fileNameOf(filePath);
  if (isPkgsUiSrc(filePath)) {
    return ensureNamedImport(
      text,
      relModule(filePath, 'component-id'),
      ['dataAttrs'],
      fileName
    );
  }
  return ensureNamedImport(text, '@pkgs/ui', ['dataAttrs'], fileName);
}

function isPkgsUiSrc(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/pkgs/ui/src/') ||
    normalized.startsWith('pkgs/ui/src/')
  );
}

function relModule(filePath: string, targetFromSrc: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = 'pkgs/ui/src/';
  const idx = normalized.indexOf(marker);
  invariant(idx >= 0, 'relModule requires pkgs/ui/src path');
  const fromFile = normalized.slice(idx + marker.length);
  const depth = fromFile.split('/').length - 1;
  const prefix = depth === 0 ? './/' : '../'.repeat(depth);
  return `${prefix}${targetFromSrc}`;
}

/** Base file name for parse-kind selection (`'file.tsx'` when unknown). */
export function fileNameOf(filePath: string): string {
  if (filePath === '') return 'file.tsx';
  return filePath.replace(/\\/g, '/').split('/').pop() ?? 'file.tsx';
}
function ensureNamedImport(
  text: string,
  modulePath: string,
  wanted: readonly string[],
  fileName = 'file.tsx'
): string {
  if (wanted.length === 0) return text;
  const source = parse(text, fileName);
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const module = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(module) || module.text !== modulePath) continue;
    const clause = stmt.importClause;
    if (clause?.namedBindings === undefined) continue;
    if (!ts.isNamedImports(clause.namedBindings)) continue;
    const have = new Set(
      clause.namedBindings.elements.map((el) => el.name.text)
    );
    const missing = wanted.filter((w) => !have.has(w));
    if (missing.length === 0) return text;
    // `import type { A }` + a runtime value → per-element `type` modifiers so
    // the value binding is not erased (TS1361).
    const typeOnly = clause.isTypeOnly === true;
    const names = [
      ...clause.namedBindings.elements.map((el) => {
        const rename =
          el.propertyName === undefined
            ? el.name.text
            : `${el.propertyName.text} as ${el.name.text}`;
        return typeOnly && el.isTypeOnly !== true ? `type ${rename}` : rename;
      }),
      ...missing,
    ];
    return applyEdits(text, [
      {
        start: clause.getStart(),
        end: clause.namedBindings.end,
        text: `{ ${names.join(', ')} }`,
      },
    ]);
  }
  const anchor = lastImportEnd(source);
  const line = `import { ${wanted.join(', ')} } from '${modulePath}';\n`;
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
