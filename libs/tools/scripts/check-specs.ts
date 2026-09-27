#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`bun run spec:check`, `//#ci:specs`).
/**
 * The spec gate: every `specs/<domain>/*.feature` scenario binds to exactly one step
 * definition, no definition is unused or pending, every scenario carries its
 * `@domain` and known `@goal`s, every goal a feature proves is tagged there,
 * step text says intent (no UI mechanics, implementation words or narrator),
 * every scenario ends in an outcome with its context first, and the catalogs
 * are current, and no scenario has a BDD smell (`@pkgs/gherkin/smells`: a
 * long script, several events, acting after a Then outside journeys,
 * architecture words, a feature without a why). Near-duplicate wording is a
 * warning; `--strict-duplicates` makes it fail.
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
import { specSmells } from '@pkgs/gherkin/smells';
import type { GoalChecks } from '../goal/goal-manifest';
import { parseGoalMarkdown } from '../goal/goal-statements';
import { catalogDrift } from './spec-catalog';
import {
  externalSteps,
  REPO_ROOT,
  sharedSteps,
  specPackages,
  specsLayoutProblems,
} from './spec-packages';

const strictDuplicates = process.argv.includes('--strict-duplicates');

/** The thresholds `docs/SPEC_DRIVEN_DEVELOPMENT.md` states for a brief scenario. */
const SMELLS = {
  maxSteps: 8,
  maxActions: 3,
  journeyDomains: new Set(['journeys']),
  suspectWords: ['server', 'servers', 'backend', 'client', 'clients', 'sim'],
} as const;

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
    goalSpecProofs.set(id, [...(goalSpecProofs.get(id) ?? []), proof.path]);
  }
}

const errors: string[] = [
  ...specsLayoutProblems(packages),
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
const smells = specSmells(
  packages.flatMap((pkg) => pkg.features),
  SMELLS
);

for (const warning of uniqueSoft) console.warn(`warning: ${warning}`);
if (
  hard.length > 0 ||
  smells.length > 0 ||
  (strictDuplicates && uniqueSoft.length > 0)
) {
  console.error('spec check failed:');
  for (const error of hard) console.error(`  ${error}`);
  if (strictDuplicates)
    for (const error of uniqueSoft) console.error(`  ${error}`);
  for (const smell of smells) console.error(`  smell: ${smell}`);
  process.exit(1);
}

const scenarios = packages.reduce(
  (n, pkg) => n + pkg.features.reduce((m, f) => m + f.scenarios.length, 0),
  0
);
console.log(
  `ok: ${String(packages.length)} packages, ${String(scenarios)} scenarios, ${String(allDefinitions.length)} step definitions, ${String(uniqueSoft.length)} wording warnings`
);
