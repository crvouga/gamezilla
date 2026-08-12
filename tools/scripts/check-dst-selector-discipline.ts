#!/usr/bin/env bun
/**
 * DST selector discipline:
 * - scenarios: no `@pkgs/ui-testing`, no `by.`
 * - drivers: no `by.(text|nth|role|label)(` — Handles + Driver testIds only
 * - `@test/ui` package: only `*.sim.test.ts(x)` under `src/scenarios/`
 *   (no RN component / Vitest / bun unit tests in this package)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const UI_SRC_DIR = join(REPO_ROOT, 'test/ui/src');
const SCENARIOS_DIR = join(REPO_ROOT, 'test/ui/src/scenarios');
const DRIVERS_DIR = join(REPO_ROOT, 'test/ui/src/drivers');

type Violation = { file: string; detail: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...walk(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function rel(path: string): string {
  return relative(REPO_ROOT, path);
}

function linesOf(path: string): string[] {
  return readFileSync(path, 'utf8').split('\n');
}

const violations: Violation[] = [];

const SIM_TEST_RE = /\.sim\.test\.tsx?$/;
const ANY_TEST_RE = /\.test\.tsx?$/;

for (const file of walk(UI_SRC_DIR)) {
  if (!ANY_TEST_RE.test(file)) continue;
  if (!file.startsWith(`${SCENARIOS_DIR}/`) || !SIM_TEST_RE.test(file)) {
    violations.push({
      file: rel(file),
      detail:
        '@test/ui may only contain src/scenarios/**/*.sim.test.ts(x) — use bun:test or jest-expo in other packages for unit/component tests',
    });
  }
}

for (const file of walk(SCENARIOS_DIR)) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('@pkgs/ui-testing')) {
    violations.push({
      file: rel(file),
      detail: 'scenarios must not import @pkgs/ui-testing (use AppDriver)',
    });
  }
  for (const [i, line] of linesOf(file).entries()) {
    if (/\bby\./.test(line)) {
      violations.push({
        file: rel(file),
        detail: `L${i + 1}: scenarios must not use by.* (use AppDriver flows)`,
      });
    }
  }
}

for (const file of walk(DRIVERS_DIR)) {
  for (const [i, line] of linesOf(file).entries()) {
    if (/\bby\.(text|nth|role|label)\(/.test(line)) {
      violations.push({
        file: rel(file),
        detail: `L${i + 1}: drivers must not use by.text/nth/role/label (handles only)`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('ci:dst-selector-discipline failed:\n');
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.detail}`);
  }
  process.exit(1);
}

console.log('ci:dst-selector-discipline ok');
