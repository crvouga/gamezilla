#!/usr/bin/env bun
/**
 * Known-bug gate (`@libs/tools#ci:goals`): every
 * `libs/tools/goal/known-bugs/<id>.json` is guarded by an example regression
 * test. Proof files inside a package are checked by that package's `lint`;
 * this gate checks the bookkeeping and any proof outside the package tiers.
 *
 * `--json` prints the machine report.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateGoalGate } from '../goal/goal-manifest';
import { readKnownBugs } from '../goal/known-bugs';

const ROOT = join(import.meta.dirname, '../../..');

function readRepoFile(path: string): string | null {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch {
    return null;
  }
}

const args = new Set(process.argv.slice(2));
const knownBugs = readKnownBugs(ROOT);
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
