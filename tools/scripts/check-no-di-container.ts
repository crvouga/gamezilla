#!/usr/bin/env bun
/**
 * Fail if DI container / registry / service-locator classes (or filenames)
 * appear under apps/ or libs/.
 *
 * No baseline file expected (zero violations). Optional WRITE_BASELINE=1 for inventory.
 */
import { basename, join, relative } from 'node:path';

import { Glob } from 'bun';
import ts from 'typescript';

import { type DiViolation, runBaselineRatchet } from './di-baseline-ratchet';

const REPO_ROOT = join(import.meta.dirname, '../..');
const BASELINE_PATH = join(
  import.meta.dirname,
  'no-di-container-baseline.json'
);

const SCAN_GLOBS = [
  'libs/*/src/**/*.{ts,tsx}',
  'apps/*/src/**/*.{ts,tsx}',
] as const;

const BANNED_CLASS_NAME = /(?:Container|Registry|ServiceLocator)$/;
const BANNED_FILENAME =
  /(?:^|[-_.])(?:container|registry|service-locator)(?:[-_.]|$)/i;

function shouldSkipFile(rel: string): boolean {
  if (rel.includes('/dist/')) return true;
  if (rel.includes('.test.')) return true;
  if (rel.includes('.types.test.')) return true;
  if (rel.startsWith('libs/infra/')) return true;
  return false;
}

function filenameIsBanned(rel: string): boolean {
  const base = basename(rel).replace(/\.(tsx?)$/, '');
  return BANNED_FILENAME.test(base);
}

function scanSourceFile(sourceFile: ts.SourceFile): DiViolation[] {
  const out: DiViolation[] = [];
  const path = relative(REPO_ROOT, sourceFile.fileName);
  const bannedFile = filenameIsBanned(path);

  for (const stmt of sourceFile.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
    const className = stmt.name.text;
    const line =
      sourceFile.getLineAndCharacterOfPosition(stmt.name.getStart(sourceFile))
        .line + 1;

    if (BANNED_CLASS_NAME.test(className)) {
      out.push({
        key: `${path}:class:${className}`,
        path,
        line,
        message: `Container/registry class '${className}' is not used. Pass primitives (SqlClient, Io) and construct on demand; use a factory function if wiring repeats. See docs/dependency-injection.md.`,
      });
      continue;
    }

    if (bannedFile) {
      out.push({
        key: `${path}:file-class:${className}`,
        path,
        line,
        message: `File name suggests a DI container ('${basename(path)}'). Use primitives + on-demand construction instead. See docs/dependency-injection.md.`,
      });
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
  ciName: 'ci:no-di-container',
  repoRoot: REPO_ROOT,
  baselinePath: BASELINE_PATH,
  violations,
  docsHint: 'See docs/dependency-injection.md.',
});
