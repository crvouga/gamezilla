import { describe, expect, test } from 'bun:test';
import type { MachineConfig, SpecBundle } from '@crvouga/atlas';
import { productStatechartSourceProblems } from './statechart-source-policy';

function bundle(files = ['product.machine.json']): SpecBundle {
  const charts = files.map((file, index) => ({
    file,
    format: 'xstate' as const,
    machine: {
      id: index === 0 ? 'gamezilla-product' : `extra-${index}`,
      initial: 'Ready',
      states: { Ready: {} },
    } satisfies MachineConfig,
  }));
  return {
    directory: 'specs',
    charts,
    root: charts[0]?.machine.id ?? '',
    journeys: [
      { name: 'Explore', description: 'Explore', events: [], endsIn: [] },
    ],
  };
}

describe('product statechart source policy', () => {
  test('accepts one product machine with journeys', () => {
    expect(productStatechartSourceProblems(bundle())).toEqual([]);
  });

  test('rejects a catalog of separate charts', () => {
    expect(
      productStatechartSourceProblems(
        bundle(['product.machine.json', 'billing.machine.yaml'])
      )
    ).toEqual([
      'Expected exactly one product statechart; found 2: product.machine.json, billing.machine.yaml',
    ]);
  });

  test('requires the canonical file and at least one journey', () => {
    const input = bundle(['other.machine.yaml']);
    input.journeys = [];
    expect(productStatechartSourceProblems(input)).toEqual([
      'The one product statechart must be specs/product.machine.json; found other.machine.yaml',
      'The product statechart has no guided journeys',
    ]);
  });
});
