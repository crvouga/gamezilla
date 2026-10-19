#!/usr/bin/env bun
/**
 * Known-bug gate (`@libs/tools#ci:goals`): every
 * `libs/tools/goal/known-bugs/<id>.json` is guarded by an example regression
 * test. This one task verifies the bookkeeping and every proof file, each
 * against the package that owns it. The register changes in a third of all
 * commits; were the proofs part of each package's `lint`, every such commit
 * would rerun every package's lint.
 *
 * `--json` prints the machine report.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateRegister } from '../goal/goal-manifest';
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
const errors = validateRegister({ knownBugs, read: readRepoFile });

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
