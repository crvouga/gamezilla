#!/usr/bin/env bun
/**
 * DST selector discipline:
 * - scenarios: no `@pkgs/ui-testing`, no `by.`
 * - harness drivers + app-driver: no `by.(text|nth|role|label)(`
 * - ui-testing-adapter: `by.testId` only (no other `by.` kinds)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCENARIOS_DIR = join(REPO_ROOT, 'test/ui/src/scenarios');
const DRIVERS_DIR = join(REPO_ROOT, 'test/ui/src/harness/drivers');
const APP_DRIVER = join(REPO_ROOT, 'test/ui/src/harness/app-driver.ts');
const ADAPTER = join(REPO_ROOT, 'test/ui/src/harness/ui-testing-adapter.ts');

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

const driverFiles = [...walk(DRIVERS_DIR), APP_DRIVER];
for (const file of driverFiles) {
  for (const [i, line] of linesOf(file).entries()) {
    if (/\bby\.(text|nth|role|label)\(/.test(line)) {
      violations.push({
        file: rel(file),
        detail: `L${i + 1}: drivers must not use by.text/nth/role/label (handles only)`,
      });
    }
  }
}

for (const [i, line] of linesOf(ADAPTER).entries()) {
  if (/\bby\.(text|nth|role|label)\(/.test(line)) {
    violations.push({
      file: rel(ADAPTER),
      detail: `L${i + 1}: adapter may use by.testId only`,
    });
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
