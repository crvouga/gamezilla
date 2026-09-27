/**
 * Manifest + validation for the goal gate (`//#ci:goals`).
 *
 * `docs/GOAL.md` says every statement must be proven by a check. This module turns
 * that into a machine rule: each statement is either `proven` with proof files
 * that carry the `goal:<id>` marker, or `unproven` with a written note, and the
 * number of unproven statements may only go down.
 */

import type { GoalStatement } from './goal-statements';

/**
 * `test`: a code test carrying `goal:<id>`; `gate`: a CI script carrying it;
 * `spec`: a `.feature` file with a scenario tagged `@goal:<id>` (the spec
 * check also verifies the tag sits on a scenario, not just in the text).
 */
export type GoalProof = {
  readonly kind: 'test' | 'gate' | 'spec';
  readonly path: string;
  readonly marker?: string;
};

export type GoalCheckEntry =
  | { readonly status: 'unproven'; readonly note: string }
  | { readonly status: 'proven'; readonly proofs: readonly GoalProof[] };

export type GoalChecks = Readonly<Record<string, GoalCheckEntry>>;

/**
 * A bug that was found and fixed. Its guard is always an example-based
 * regression test: the concrete input that broke, pinned forever. Properties
 * and models explore; they are not guards, because a pinned seed that happens
 * to reach the bug today may not after the generator changes.
 */
export type KnownBug = {
  readonly id: string;
  readonly summary: string;
  /**
   * Repo-relative test file carrying `regression: <id>` beside the test, or
   * a `.feature` whose pinned scenario is tagged `@regression:<id>`.
   */
  readonly regressionTest: string;
};

export type GoalGateInput = {
  readonly statements: readonly GoalStatement[];
  readonly checks: GoalChecks;
  readonly knownBugs: readonly KnownBug[];
  readonly proofFiles: ProofFiles;
  readonly unprovenBudget: number;
};

/**
 * Which proof files a run reads. The root gate owns paths outside the package
 * tiers; each package's `lint` owns its own, so a proof file's edit reruns only
 * its package, and the bookkeeping reruns only when the manifest changes.
 */
export type ProofFiles = {
  readonly owns: (path: string) => boolean;
  /** Reads a repo-relative path; `null` when the file is missing. */
  readonly read: (path: string) => string | null;
};

export function countUnproven(checks: GoalChecks): number {
  return Object.values(checks).filter((e) => e.status === 'unproven').length;
}

function validateProof(
  label: string,
  proof: GoalProof,
  files: ProofFiles,
  errors: string[]
): void {
  if (proof.kind !== 'test' && proof.kind !== 'gate' && proof.kind !== 'spec') {
    errors.push(`${label}: proof kind must be "test", "gate" or "spec"`);
  }
  if (typeof proof.path !== 'string' || proof.path.length === 0) {
    errors.push(`${label}: proof path is required`);
    return;
  }
  if (proof.kind === 'spec' && !proof.path.endsWith('.feature')) {
    errors.push(
      `${label}: a spec proof must be a .feature file: ${proof.path}`
    );
    return;
  }
  if (proof.kind !== 'spec' && proof.path.endsWith('.feature')) {
    errors.push(
      `${label}: ${proof.path} is a feature file — use proof kind "spec"`
    );
    return;
  }
  if (!files.owns(proof.path)) return;
  const body = files.read(proof.path);
  if (body === null) {
    errors.push(`${label}: proof file not found: ${proof.path}`);
    return;
  }
  const marker =
    proof.marker !== undefined && proof.marker.length > 0
      ? proof.marker
      : `${proof.kind === 'spec' ? '@' : ''}goal:${label}`;
  if (!body.includes(marker)) {
    errors.push(`${label}: ${proof.path} does not contain marker "${marker}"`);
  }
}

function validateIdSets(
  statements: readonly GoalStatement[],
  checks: GoalChecks,
  errors: string[]
): ReadonlySet<string> {
  const ids = new Set(statements.map((statement) => statement.id));
  for (const id of ids) {
    if (checks[id] === undefined) {
      errors.push(`${id}: GOAL.md statement has no goal-checks.json entry`);
    }
  }
  for (const id of Object.keys(checks)) {
    if (!ids.has(id)) {
      errors.push(`${id}: goal-checks.json entry has no GOAL.md statement`);
    }
  }
  return ids;
}

function validateEntry(
  statement: GoalStatement,
  entry: GoalCheckEntry,
  files: ProofFiles,
  errors: string[]
): void {
  const proven = entry.status === 'proven';
  if (statement.checked !== proven) {
    errors.push(
      `${statement.id}: GOAL.md checkbox is ${
        statement.checked ? 'checked' : 'unchecked'
      } but manifest status is "${entry.status}"`
    );
  }
  if (entry.status === 'unproven') {
    if (entry.note.trim().length === 0) {
      errors.push(`${statement.id}: unproven entry needs a note`);
    }
    return;
  }
  if (entry.proofs.length === 0) {
    errors.push(`${statement.id}: proven entry needs at least one proof`);
  }
  for (const proof of entry.proofs) {
    validateProof(statement.id, proof, files, errors);
  }
}

const TEST_FILE = /\.test\.tsx?$/;
const PROPERTY_FILE = /\.property\.test\.tsx?$/;
const FEATURE_FILE = /\.feature$/;

export function regressionMarker(bugId: string): string {
  return `regression: ${bugId}`;
}

/** The scenario tag that pins a known bug in a `.feature` file. */
export function regressionTag(bugId: string): string {
  return `@regression:${bugId}`;
}

function validateRegressionTest(
  bug: KnownBug,
  files: ProofFiles,
  errors: string[]
): void {
  const label = `known-bugs:${bug.id}`;
  const path = bug.regressionTest;
  const feature = typeof path === 'string' && FEATURE_FILE.test(path);
  if (typeof path !== 'string' || !(feature || TEST_FILE.test(path))) {
    errors.push(
      `${label}: regressionTest must be a *.test.ts(x) or *.feature file`
    );
    return;
  }
  if (PROPERTY_FILE.test(path)) {
    errors.push(
      `${label}: ${path} is a property test — a regression guard is an example test that pins the input that broke`
    );
    return;
  }
  if (!files.owns(path)) return;
  const body = files.read(path);
  if (body === null) {
    errors.push(`${label}: regression test not found: ${path}`);
    return;
  }
  const marker = feature ? regressionTag(bug.id) : regressionMarker(bug.id);
  if (!body.includes(marker)) {
    errors.push(`${label}: ${path} does not contain marker "${marker}"`);
  }
}

function validateKnownBugs(
  bugs: readonly KnownBug[],
  files: ProofFiles,
  errors: string[]
): void {
  const seen = new Set<string>();
  for (const bug of bugs) {
    if (seen.has(bug.id)) {
      errors.push(`known-bugs: duplicate id "${bug.id}"`);
    }
    seen.add(bug.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(bug.id)) {
      errors.push(`known-bugs: id "${bug.id}" must be lower-kebab-case`);
    }
    if (bug.summary.trim().length === 0) {
      errors.push(`known-bugs: entry "${bug.id}" needs a summary`);
    }
    validateRegressionTest(bug, files, errors);
  }
}

export function validateGoalGate(input: GoalGateInput): readonly string[] {
  const errors: string[] = [];
  validateIdSets(input.statements, input.checks, errors);

  for (const statement of input.statements) {
    const entry = input.checks[statement.id];
    if (entry === undefined) continue;
    validateEntry(statement, entry, input.proofFiles, errors);
  }

  const unproven = countUnproven(input.checks);
  if (unproven > input.unprovenBudget) {
    errors.push(
      `unproven budget exceeded: ${unproven} unproven statements, budget is ${input.unprovenBudget}`
    );
  }

  validateKnownBugs(input.knownBugs, input.proofFiles, errors);
  return errors;
}

/**
 * Missing or unmarked proof files among those `files` owns — the half of the
 * gate a package's `lint` runs for the proofs that live in it.
 */
export function validateProofFiles(input: {
  readonly checks: GoalChecks;
  readonly knownBugs: readonly KnownBug[];
  readonly files: ProofFiles;
}): readonly string[] {
  const errors: string[] = [];
  for (const [id, entry] of Object.entries(input.checks)) {
    if (entry.status !== 'proven') continue;
    for (const proof of entry.proofs) {
      validateProof(id, proof, input.files, errors);
    }
  }
  for (const bug of input.knownBugs) {
    validateRegressionTest(bug, input.files, errors);
  }
  return errors;
}
