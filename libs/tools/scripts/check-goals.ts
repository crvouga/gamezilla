#!/usr/bin/env bun
// goal:the-bar:2 goal:the-bar:6
/**
 * Goal gate (`//#ci:goals`): `docs/GOAL.md` promises that every definition-of-done
 * statement is proven by an automated check. This enforces the bookkeeping:
 * every statement has a manifest entry, checked boxes and `proven` status
 * agree, known bugs are guarded, and the number of unproven statements may
 * only go down. Proof files outside the package tiers are checked here; each
 * package's `lint` checks the proofs inside it exist and carry `goal:<id>`, so
 * editing a proof reruns its package and not this gate.
 *
 * `--count-unproven` prints the current count (used to set the ratchet).
 * `--json` prints the machine report.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GoalChecks, KnownBug } from '../goal/goal-manifest';
import { countUnproven, validateGoalGate } from '../goal/goal-manifest';
import { parseGoalMarkdown } from '../goal/goal-statements';

const ROOT = join(import.meta.dirname, '../../..');
const GOAL_PATH = 'docs/GOAL.md';
const CHECKS_PATH = 'libs/tools/goal/goal-checks.json';
const BUGS_PATH = 'libs/tools/goal/known-bugs.json';

/**
 * Ratchet: the number of statements that are not yet proven by a check. Later
 * PRs may only lower this (and the manifest entry must move to `proven`).
 */
const UNPROVEN_BUDGET = 0;

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
    console.error(`goal gate: missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(body) as T;
}

const args = new Set(process.argv.slice(2));
const checks = readJson<GoalChecks>(CHECKS_PATH);

if (args.has('--count-unproven')) {
  console.log(String(countUnproven(checks)));
  process.exit(0);
}

const statements = parseGoalMarkdown(readRepoFile(GOAL_PATH) ?? '');
const knownBugs = readJson<readonly KnownBug[]>(BUGS_PATH);
const errors = validateGoalGate({
  statements,
  checks,
  knownBugs,
  proofFiles: {
    owns: (path) => !/^(apps|libs|pkgs)\//.test(path),
    read: readRepoFile,
  },
  unprovenBudget: UNPROVEN_BUDGET,
});

if (args.has('--json')) {
  console.log(
    JSON.stringify(
      {
        statements: statements.length,
        unproven: countUnproven(checks),
        budget: UNPROVEN_BUDGET,
        errors,
      },
      null,
      2
    )
  );
  process.exit(errors.length === 0 ? 0 : 1);
}

if (errors.length > 0) {
  console.error('goal gate failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(
  `ok: ${statements.length} goal statements, ${countUnproven(checks)} unproven (budget ${UNPROVEN_BUDGET})`
);
