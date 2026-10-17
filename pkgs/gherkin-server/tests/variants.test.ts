/**
 * A host can run a scenario once per variant it defines (one per subject the
 * scenario holds for): each variant is its own test in a fresh world, named
 * `<scenario> [<label>]`, recording its own verdict, so a failure names the
 * variant and the others still run and report.
 */

import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server/evidence-store';
import { runFeature } from '@pkgs/gherkin-server/bun-test';
import type { ScenarioContext } from '@pkgs/gherkin-shared/registry';
import {
  defineScenarioVariants,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin-shared/registry';

type World = { readonly variant: string; readonly testId: string };

const reportDir = mkdtempSync(join(tmpdir(), 'gherkin-variants-'));
afterAll(() => rmSync(reportDir, { recursive: true, force: true }));

const worlds: World[] = [];
const { Given, Then } = stepsFor<World>();

setWorld<World>({
  create: async (ctx: ScenarioContext) => {
    const world = { variant: ctx.variant?.id ?? 'none', testId: ctx.testId };
    worlds.push(world);
    return world;
  },
  dispose: async () => {},
});

defineScenarioVariants((ctx) =>
  ctx.scenarioName.startsWith('Every')
    ? [
        { id: 'first', label: 'the first subject' },
        { id: 'second', label: 'the second subject' },
      ]
    : null
);

Given('a subject', () => {});
Then('the subject holds', () => {});

runFeature(
  `Feature: Variants
  Scenario: Every subject holds
    Given a subject
    Then the subject holds

  Scenario: One run holds
    Given a subject
    Then the subject holds
`,
  {
    packageName: '@pkgs/gherkin',
    featureUri: 'specs/gherkin/variants.feature',
    reportDir,
  }
);

test('a varied scenario runs once per variant in its own world; others run once', () => {
  expect(worlds.map((world) => world.variant)).toEqual([
    'first',
    'second',
    'none',
  ]);
  expect(new Set(worlds.map((world) => world.testId)).size).toBe(3);
  expect(worlds[0]?.testId).toBe('variants.every-subject-holds.first');
});

test('each variant records its own verdict, named for the variant', () => {
  const { records } = readEvidence(reportDir);
  expect(
    records.flatMap((record) => record.obligations.map((o) => o.id)).sort()
  ).toEqual([
    'scenario:Every subject holds [first]',
    'scenario:Every subject holds [second]',
    'scenario:One run holds',
  ]);
});
