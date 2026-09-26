#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`bun run spec:check`, `//#ci:specs`).
/**
 * The spec gate: every `features/**` scenario binds to exactly one step
 * definition, no definition is unused or pending, every scenario carries its
 * `@domain` and known `@goal`s, every goal a feature proves is tagged there,
 * step text says intent (no UI mechanics), and the catalogs are current.
 * Near-duplicate wording is reported as a warning (`--strict-duplicates`
 * makes it fail).
 *
 * Static: it parses features and reads `tests/steps/**` as text, so it runs
 * in well under a second and needs no sim.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPEC_PARAMETER_TYPES } from '@libs/sim-harness/spec/parameter-types';
import { checkSpecs } from '@pkgs/gherkin/check';
import { parameterTypeRegistryFrom } from '@pkgs/gherkin/registry';
import { nearDuplicates } from '@pkgs/gherkin/similarity';
import type { GoalChecks } from '../goal/goal-manifest';
import { parseGoalMarkdown } from '../goal/goal-statements';
import { catalogDrift } from './spec-catalog';
import {
  externalSteps,
  REPO_ROOT,
  sharedSteps,
  specPackages,
} from './spec-packages';

const strictDuplicates = process.argv.includes('--strict-duplicates');

const parameterTypes = parameterTypeRegistryFrom(SPEC_PARAMETER_TYPES);

const statements = parseGoalMarkdown(
  readFileSync(join(REPO_ROOT, 'docs/GOAL.md'), 'utf8')
);
const checks = JSON.parse(
  readFileSync(join(REPO_ROOT, 'libs/tools/goal/goal-checks.json'), 'utf8')
) as GoalChecks;
const packages = specPackages();
const shared = sharedSteps();
const external = externalSteps(packages);

const goalSpecProofs = new Map<string, string[]>();
for (const [id, entry] of Object.entries(checks)) {
  if (entry.status !== 'proven') continue;
  for (const proof of entry.proofs) {
    if (proof.kind !== 'spec') continue;
    const pkg = packages.find((p) => proof.path.startsWith(`${p.dir}/`));
    const uri =
      pkg === undefined ? proof.path : proof.path.slice(pkg.dir.length + 1);
    goalSpecProofs.set(id, [...(goalSpecProofs.get(id) ?? []), uri]);
  }
}

const errors: string[] = [
  ...shared.problems,
  ...packages.flatMap((pkg) => pkg.problems),
  ...external.problems,
  ...checkSpecs({
    packages,
    external: external.steps,
    shared: shared.steps,
    parameterTypes,
    goalIds: new Set(statements.map((s) => s.id)),
    goalSpecProofs,
  }),
  ...catalogDrift(packages, shared.steps),
];

const allDefinitions = [
  ...shared.steps,
  ...external.steps,
  ...packages.flatMap((pkg) => pkg.definitions),
];
const duplicates = nearDuplicates(
  allDefinitions,
  (step) => step.text,
  (step) => step.kind
).map(
  (pair) =>
    `near-duplicate wording: "${pair.a.text}" (${pair.a.file}:${String(pair.a.line)}) vs "${pair.b.text}" (${pair.b.file}:${String(pair.b.line)})`
);

const hard = errors;
const uniqueSoft = [...new Set(duplicates)];

for (const warning of uniqueSoft) console.warn(`warning: ${warning}`);
if (hard.length > 0 || (strictDuplicates && uniqueSoft.length > 0)) {
  console.error('spec check failed:');
  for (const error of hard) console.error(`  ${error}`);
  if (strictDuplicates)
    for (const error of uniqueSoft) console.error(`  ${error}`);
  process.exit(1);
}

const scenarios = packages.reduce(
  (n, pkg) => n + pkg.features.reduce((m, f) => m + f.scenarios.length, 0),
  0
);
console.log(
  `ok: ${String(packages.length)} packages, ${String(scenarios)} scenarios, ${String(allDefinitions.length)} step definitions, ${String(uniqueSoft.length)} wording warnings`
);
