import { expect, test } from 'bun:test';
import { closureProblems } from '@pkgs/conformance-shared-ts/closure';
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

test('Pong retains gated specification coverage', () => {
  // regression: pong-missing-release-conformance — specs/pong/ was absent from product.contexts.
  const { world, specs, problems } = readConformanceWorld();
  if (world === null) throw new Error('conformance manifest did not parse');
  expect(problems).toEqual([]);
  expect(closureProblems(world)).toEqual([]);
  expect(world.specDirectories).toContain('pong');
  expect(
    specs.find((spec) => spec.path === 'specs/pong/pong-local-play.feature')
  ).toMatchObject({ kind: 'behavior', bound: true, harness: true });
});
