/**
 * With a `reportDir`, every decided scenario is one `scenario:<name>`
 * obligation of its feature's behavior evidence; a host-limited scenario
 * proved nothing and records nothing.
 */

import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunReport } from '@crvouga/atlas/reports/report-types';
import { readEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { sha256 } from '@pkgs/conformance-shared-ts/evidence';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { runFeature } from '@pkgs/gherkin-server-ts/bun-test';
import { recordScenario } from '@pkgs/gherkin-server-ts/evidence';
import {
  hostLimit,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin-shared-ts/registry';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const reportDir = mkdtempSync(join(tmpdir(), 'gherkin-evidence-'));
afterAll(() => removeTree(reportDir, { whenLocked: 'leave' }));

const { Then } = stepsFor<object>();
const store = new ObjectStoreImplInMemory();
let measuredTime = 0;
setWorld<object>({ create: async () => ({}), dispose: async () => {} });
Then('the evidence world holds', () => {
  measuredTime += 60;
});
Then('the evidence world cannot run here', () => {
  throw hostLimit('this host cannot do that');
});

const feature = `Feature: Evidence
  Scenario: A scenario that passes
    Then the evidence world holds

  Scenario: A scenario the host cannot finish
    Then the evidence world cannot run here
`;

runFeature(feature, {
  packageName: '@pkgs/gherkin',
  featureUri: 'specs/gherkin/evidence.feature',
  reportDir,
  layer: 'release',
  report: {
    store,
    runId: 'measured',
    frames: false,
    performance: { clock: { now: () => measuredTime }, slowStepMs: 50 },
  },
});

test('a world without a recorder publishes a measured scenario timeline', async () => {
  const text = await readUtf8(
    store,
    'runs/measured/tests/evidence.a-scenario-that-passes/report.json'
  );
  expect(text).not.toBeNull();
  const report = JSON.parse(text!) as RunReport;
  expect(report.meta.sourceFile).toBe('specs/gherkin/evidence.feature');
  expect(report.meta.performance?.slowSteps).toBe(1);
  expect(report.steps[0]?.performance?.selfMs).toBe(60);
  expect(report.steps[0]?.title).toBe('Then the evidence world holds');
});

// regression: report-host-limit-evidence
test('the passing scenario is recorded, the host-limited one is not', async () => {
  expect(
    await store.get(
      'runs/measured/tests/evidence.a-scenario-the-host-cannot-finish/report.json'
    )
  ).toBeNull();
  const { records, malformed } = readEvidence(reportDir);
  expect(malformed).toEqual([]);
  expect(records).toEqual([
    {
      specUri: 'specs/gherkin/evidence.feature',
      kind: 'behavior',
      specSha256: sha256(feature),
      packageName: '@pkgs/gherkin',
      obligations: [
        {
          id: 'scenario:A scenario that passes',
          layer: 'release',
          status: 'pass',
        },
      ],
    },
  ]);
});

test('a failed scenario is recorded as failing, beside the others', () => {
  recordScenario({
    reportDir,
    packageName: '@pkgs/gherkin',
    featureUri: 'specs/gherkin/evidence.feature',
    featureSource: feature,
    layer: 'release',
    scenarioName: 'A scenario that fails',
    status: 'fail',
    detail: 'expected 1 to be 2',
  });
  const [record] = readEvidence(reportDir).records;
  expect(record?.obligations).toEqual([
    {
      id: 'scenario:A scenario that fails',
      layer: 'release',
      status: 'fail',
      detail: 'expected 1 to be 2',
    },
    { id: 'scenario:A scenario that passes', layer: 'release', status: 'pass' },
  ]);
});
