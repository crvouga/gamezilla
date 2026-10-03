import { expect, test } from 'bun:test';
import { closureProblems } from '@pkgs/conformance/closure';
import { campaignBindings } from '../conformance/campaigns';
import { EVIDENCE_MAP } from '../conformance/evidence-map';
import { readConformanceWorld } from '../conformance/world';

test('semantic decisions remain bound without inventing an access capability', () => {
  // regression: conformance-semantic-decision-capability
  const { world, specs } = readConformanceWorld();
  if (world === null) throw new Error('conformance manifest did not parse');
  expect(
    world.decisions.some((decision) => decision.id === 'assistant-observation')
  ).toBe(false);
  expect(
    specs.find((spec) => spec.path === 'specs/chess/assistant-observation.dmn')
  ).toMatchObject({
    kind: 'decisions',
    bound: true,
    harness: true,
  });
});

test('every declared environment and public contract has evidence mappings', () => {
  // regression: conformance-evidence-map-missing-promises
  const { manifest } = readConformanceWorld();
  if (manifest === null) throw new Error('conformance manifest did not parse');
  expect(Object.keys(EVIDENCE_MAP.environments).sort()).toEqual(
    manifest.environments.map((environment) => environment.id).sort()
  );
  expect(Object.keys(EVIDENCE_MAP['public contracts']).sort()).toEqual(
    manifest.product['public contracts'].map((contract) => contract.id).sort()
  );
});

test('whole-product campaign modules retain gated specification coverage', () => {
  // regression: conformance-campaign-coverage
  const { world, specs, problems } = readConformanceWorld();
  if (world === null) throw new Error('conformance manifest did not parse');
  expect(problems).toEqual([]);
  expect(closureProblems(world)).toEqual([]);
  expect(world.specDirectories).not.toContain('system');
  expect(
    specs.find((spec) => spec.path === 'specs/system/access-sync.qnt')
  ).toMatchObject({
    kind: 'dynamics',
    bound: true,
    harness: false,
    live: false,
  });
  const ungated = campaignBindings(new Set());
  expect(ungated.problems).toContain(
    'specs/system/: the release gate does not run @apps/product#test:contract'
  );
  expect(ungated.specs.every((spec) => !spec.bound)).toBe(true);
});
