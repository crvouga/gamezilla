import { expect, test } from 'bun:test';
import { EVIDENCE_MAP } from '../conformance/evidence-map';
import { readConformanceWorld } from '../conformance/world';

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
