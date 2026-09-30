#!/usr/bin/env bun
/**
 * Known-bug gate (`//#ci:goals`): every entry in
 * `libs/tools/goal/known-bugs.json` is guarded by an example regression
 * test. Proof files inside a package are checked by that package's `lint`;
 * this gate checks the bookkeeping and any proof outside the package tiers.
 *
 * `--json` prints the machine report.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { KnownBug } from '../goal/goal-manifest';
import { validateGoalGate } from '../goal/goal-manifest';

const ROOT = join(import.meta.dirname, '../../..');
const BUGS_PATH = 'libs/tools/goal/known-bugs.json';

function readRepoFile(path: string): string | null {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch {
    return null;
  }
}

function readJson<T>(path: string): T {
  const body = readRepoFile(path);
  if (body === null) {
    console.error(`known-bug gate: missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(body) as T;
}

const args = new Set(process.argv.slice(2));
const knownBugs = readJson<readonly KnownBug[]>(BUGS_PATH);
const errors = validateGoalGate({
  knownBugs,
  proofFiles: {
    owns: (path) => !/^(apps|libs|pkgs)\//.test(path),
    read: readRepoFile,
  },
});

if (args.has('--json')) {
  console.log(JSON.stringify({ knownBugs: knownBugs.length, errors }, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}

if (errors.length > 0) {
  console.error('known-bug gate failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`ok: ${knownBugs.length} known bugs guarded`);
