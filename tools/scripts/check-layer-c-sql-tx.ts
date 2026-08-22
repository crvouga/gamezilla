#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Fail if Layer C classes (*Repository|*Service|*Publisher|*Handler) take
 * `SqlClient` in their constructor. They must take `SqlTx` (or a Pick alias).
 * `*UseCase` classes may take `SqlClient`.
 *
 * No baseline file expected (zero violations). Optional WRITE_BASELINE=1 for inventory.
 */
import { join, relative } from 'node:path';

import { Glob } from 'bun';
import ts from 'typescript';

import { type DiViolation, runBaselineRatchet } from './di-baseline-ratchet';

const REPO_ROOT = join(import.meta.dirname, '../..');
const BASELINE_PATH = join(import.meta.dirname, 'layer-c-sql-tx-baseline.json');

const SCAN_GLOBS = [
  'libs/*/src/**/*.{ts,tsx}',
  'apps/*/src/**/*.{ts,tsx}',
  'sim/*/src/**/*.{ts,tsx}',
] as const;

const LAYER_C_SUFFIX = /(?:Repository|Service|Publisher|Handler)$/;

function shouldSkipFile(rel: string): boolean {
  if (rel.includes('/dist/')) return true;
  if (rel.includes('.test.')) return true;
  if (rel.includes('.types.test.')) return true;
  if (rel.startsWith('libs/db/')) return true;
  return false;
}

function collectTypeAliases(
  sourceFile: ts.SourceFile
): Map<string, ts.TypeNode> {
  const aliases = new Map<string, ts.TypeNode>();
  for (const stmt of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(stmt)) continue;
    aliases.set(stmt.name.text, stmt.type);
  }
  return aliases;
}

/**
 * True when the type is (or aliases to) bare `SqlClient`.
 * `SqlTx`, `Pick<SqlClient, …>`, and aliases to those are allowed.
 */
function isBareSqlClient(
  typeNode: ts.TypeNode | undefined,
  aliases: Map<string, ts.TypeNode>,
  seen: Set<string> = new Set()
): boolean {
  if (!typeNode) return false;

  if (
    ts.isTypeOperatorNode(typeNode) &&
    typeNode.operator === ts.SyntaxKind.ReadonlyKeyword
  ) {
    return isBareSqlClient(typeNode.type, aliases, seen);
  }
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return isBareSqlClient(typeNode.type, aliases, seen);
  }

  // Pick/Omit/Partial/Required of SqlClient → SqlTx-shaped, allowed
  if (
    ts.isTypeReferenceNode(typeNode) &&
    ts.isIdentifier(typeNode.typeName) &&
    (typeNode.typeName.text === 'Pick' ||
      typeNode.typeName.text === 'Omit' ||
      typeNode.typeName.text === 'Partial' ||
      typeNode.typeName.text === 'Required')
  ) {
    return false;
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const name = typeNode.typeName.text;
    if (name === 'SqlClient') return true;
    if (name === 'SqlTx' || name === 'MutationDb') return false;
    if (aliases.has(name) && !seen.has(name)) {
      seen.add(name);
      return isBareSqlClient(aliases.get(name), aliases, seen);
    }
  }

  return false;
}

function scanSourceFile(sourceFile: ts.SourceFile): DiViolation[] {
  const aliases = collectTypeAliases(sourceFile);
  const out: DiViolation[] = [];
  const path = relative(REPO_ROOT, sourceFile.fileName);

  for (const stmt of sourceFile.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
    const className = stmt.name.text;
    if (!LAYER_C_SUFFIX.test(className)) continue;
    if (className.endsWith('UseCase')) continue;

    for (const member of stmt.members) {
      if (!ts.isConstructorDeclaration(member)) continue;
      for (const param of member.parameters) {
        if (!isBareSqlClient(param.type, aliases)) continue;
        const paramName = ts.isIdentifier(param.name)
          ? param.name.text
          : 'param';
        const line =
          sourceFile.getLineAndCharacterOfPosition(param.getStart(sourceFile))
            .line + 1;
        out.push({
          key: `${path}:${className}:${paramName}`,
          path,
          line,
          message: `${className} constructor takes SqlClient — Layer C must take SqlTx (never SqlClient). Only use-case classes take SqlClient. See docs/dependency-injection.md.`,
        });
      }
    }
  }

  return out;
}

const violations: DiViolation[] = [];

for (const pattern of SCAN_GLOBS) {
  const files = new Glob(pattern).scan({ cwd: REPO_ROOT, absolute: true });
  for await (const abs of files) {
    const rel = relative(REPO_ROOT, abs);
    if (shouldSkipFile(rel)) continue;
    const text = await Bun.file(abs).text();
    const sourceFile = ts.createSourceFile(
      abs,
      text,
      ts.ScriptTarget.Latest,
      true,
      abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    violations.push(...scanSourceFile(sourceFile));
  }
}

runBaselineRatchet({
  ciName: 'ci:layer-c-sql-tx',
  repoRoot: REPO_ROOT,
  baselinePath: BASELINE_PATH,
  violations,
  docsHint: 'See docs/dependency-injection.md.',
});
