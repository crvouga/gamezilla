#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Residual DST layout gate: `@sim/test` may only contain
 * sim.test files under `src/scenarios/`.
 * Selector / ui-testing bans live in Biome plugin `no-dst-raw-selectors.grit`.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SIM_TEST_DIR = join(REPO_ROOT, 'sim/test/src');
const SCENARIOS_DIR = join(REPO_ROOT, 'sim/test/src/scenarios');

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

const SIM_TEST_RE = /\.sim\.test\.tsx?$/;
const ANY_TEST_RE = /\.test\.tsx?$/;
const violations: string[] = [];

for (const file of walk(SIM_TEST_DIR)) {
  if (!ANY_TEST_RE.test(file)) continue;
  if (!file.startsWith(`${SCENARIOS_DIR}/`) || !SIM_TEST_RE.test(file)) {
    violations.push(
      `${relative(REPO_ROOT, file)}: @sim/test may only contain src/scenarios/**/*.sim.test.ts(x)`
    );
  }
}

if (violations.length > 0) {
  console.error('ci:dst-selector-discipline failed:\n');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log('ci:dst-selector-discipline ok');
