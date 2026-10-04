/**
 * With a `reportDir`, every decided scenario is one `scenario:<name>`
 * obligation of its feature's behavior evidence; a host-limited scenario
 * proved nothing and records nothing.
 */

import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server/evidence-store';
import { sha256 } from '@pkgs/conformance-shared/evidence';
import { runFeature } from '@pkgs/gherkin-server/bun-test';
import { recordScenario } from '@pkgs/gherkin-server/evidence';
import { hostLimit, setWorld, stepsFor } from '@pkgs/gherkin-shared/registry';

const reportDir = mkdtempSync(join(tmpdir(), 'gherkin-evidence-'));
afterAll(() => rmSync(reportDir, { recursive: true, force: true }));

const { Then } = stepsFor<object>();
setWorld<object>({ create: async () => ({}), dispose: async () => {} });
Then('the evidence world holds', () => {});
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
});

test('the passing scenario is recorded, the host-limited one is not', () => {
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
