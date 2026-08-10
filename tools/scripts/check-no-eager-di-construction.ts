#!/usr/bin/env bun
/**
 * Fail if repositories/services are eagerly constructed into long-lived fields
 * or at module scope.
 *
 * Catches:
 * - constructor body: `this.x = new Y(...)`
 * - field initializer: `x = new Y()`
 * - module-level: `new FooRepository|Service|Publisher|Handler(...)`
 *
 * No baseline file expected (zero violations). Optional WRITE_BASELINE=1 for inventory.
 */
import { join, relative } from 'node:path';

import { Glob } from 'bun';
import ts from 'typescript';

import { type DiViolation, runBaselineRatchet } from './di-baseline-ratchet';

const REPO_ROOT = join(import.meta.dirname, '../..');
const BASELINE_PATH = join(
  import.meta.dirname,
  'no-eager-di-construction-baseline.json'
);

const SCAN_GLOBS = [
  'libs/*/src/**/*.{ts,tsx}',
  'apps/*/src/**/*.{ts,tsx}',
] as const;

const LAYER_C_SUFFIX = /(?:Repository|Service|Publisher|Handler)$/;

function shouldSkipFile(rel: string): boolean {
  if (rel.includes('/dist/')) return true;
  if (rel.includes('.test.')) return true;
  if (rel.includes('.types.test.')) return true;
  if (rel.startsWith('libs/infra/')) return true;
  return false;
}

function isLayerCCallee(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) return LAYER_C_SUFFIX.test(expr.text);
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return LAYER_C_SUFFIX.test(expr.name.text);
  }
  return false;
}

function scanSourceFile(sourceFile: ts.SourceFile): DiViolation[] {
  const out: DiViolation[] = [];
  const path = relative(REPO_ROOT, sourceFile.fileName);

  const report = (node: ts.Node, message: string, keySuffix: string): void => {
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;
    out.push({
      key: `${path}:${String(line)}:${keySuffix}`,
      path,
      line,
      message,
    });
  };

  function visit(node: ts.Node): void {
    // Field initializer: `readonly x = new FooRepository()`
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      ts.isNewExpression(node.initializer) &&
      isLayerCCallee(node.initializer.expression)
    ) {
      report(
        node.initializer,
        'Eager construction: class fields must not be initialized with `new X()`. Construct on demand inside a transaction. See docs/dependency-injection.md.',
        'field-init'
      );
    }

    // Constructor body: `this.x = new FooRepository()`
    if (ts.isConstructorDeclaration(node) && node.body) {
      for (const stmt of node.body.statements) {
        if (!ts.isExpressionStatement(stmt)) continue;
        const expr = stmt.expression;
        if (!ts.isBinaryExpression(expr)) continue;
        if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
        if (
          ts.isPropertyAccessExpression(expr.left) &&
          expr.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
          ts.isNewExpression(expr.right) &&
          isLayerCCallee(expr.right.expression)
        ) {
          report(
            expr.right,
            'Eager construction: do not assign `new X()` to a field in a constructor. Construct repositories/services on demand inside a transaction at the point of use. See docs/dependency-injection.md.',
            'ctor-assign'
          );
        }
      }
    }

    // Module-level Layer C construction
    if (ts.isSourceFile(node)) {
      for (const stmt of node.statements) {
        if (!ts.isVariableStatement(stmt)) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (!decl.initializer || !ts.isNewExpression(decl.initializer)) {
            continue;
          }
          if (!isLayerCCallee(decl.initializer.expression)) continue;
          report(
            decl.initializer,
            'Module-level construction of a repository/service. These are transaction-scoped — construct them inside a `db.transaction(...)` callback.',
            'module-new'
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
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
  ciName: 'ci:no-eager-di-construction',
  repoRoot: REPO_ROOT,
  baselinePath: BASELINE_PATH,
  violations,
  docsHint: 'See docs/dependency-injection.md.',
});
