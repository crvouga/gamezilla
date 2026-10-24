import { expect, test } from 'bun:test';
import type { ReportPart } from '@crvouga/atlas/reports/explorer-types';
import {
  distinctHeaders,
  distinctLayers,
  layerEvidence,
  layerExecutionKey,
} from '@crvouga/atlas/reports/layer-merge';
import type { LayerSummary } from '@crvouga/atlas/reports/layer-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const SHA = 'a'.repeat(40);
const CHECK = {
  id: 'case',
  title: 'Check',
  status: 'passed' as const,
  detail: '',
  measurements: [],
};
const PART: ReportPart = {
  sha: SHA,
  id: 'checks',
  kind: 'unit',
  title: 'Checks',
  recordedAtMs: 1,
  checks: [CHECK],
};

function assertOneExecution(reordered: ReportPart) {
  const common = {
    producer: 'example',
    sha: SHA,
    recordedAtMs: 1,
    branch: null,
    runUrl: null,
    parameters: {},
    specs: [],
    source: null,
    recording: null,
  };
  const archived: LayerSummary = {
    ...common,
    id: 'b'.repeat(64),
    parts: [PART],
  };
  const mutable: LayerSummary = {
    ...common,
    id: `source-${SHA}-example`,
    parts: [reordered],
  };
  expect(mutable.parts).toEqual(archived.parts);
  expect(layerExecutionKey(mutable)).toBe(layerExecutionKey(archived));
  expect(distinctLayers([mutable, archived])).toEqual([archived]);
  const archivedHeader = layerEvidence(archived, 'shared').layer;
  const mutableHeader = layerEvidence(mutable, 'shared').layer;
  expect(distinctHeaders([mutableHeader, archivedHeader])).toEqual([
    archivedHeader,
  ]);
}

test('a reordered part keeps the same archived execution', () => {
  // regression: atlas-execution-key-object-order
  assertOneExecution({
    checks: [
      {
        measurements: [],
        detail: '',
        status: 'passed',
        title: 'Check',
        id: 'case',
      },
    ],
    recordedAtMs: 1,
    title: 'Checks',
    kind: 'unit',
    id: 'checks',
    sha: SHA,
  });
});

function permutations<T extends object>(value: T) {
  const keys = Object.keys(value) as (keyof T)[];
  return fc
    .shuffledSubarray(keys, { minLength: keys.length, maxLength: keys.length })
    .map(
      (order) => Object.fromEntries(order.map((key) => [key, value[key]])) as T
    );
}

test('nested object permutations preserve execution identity and deduplication', async () => {
  await assertProperty(
    'Atlas execution identities ignore part and check insertion order',
    fc.property(permutations(PART), permutations(CHECK), (part, check) => {
      assertOneExecution({ ...part, checks: [check] });
    })
  );
});
