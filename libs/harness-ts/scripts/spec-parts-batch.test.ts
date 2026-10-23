import { expect, test } from 'bun:test';
import { partsOf, type SpecUnit } from '@libs/harness-ts/spec-parts';

test('a complete assignment reads its inventory once across sixty-four parts', () => {
  // regression: spec-parts-repeats-suite-planning
  const units: readonly SpecUnit[] = [
    { path: 'heavy.qnt', weight: 8 },
    { path: 'middle.qnt', weight: 5 },
    { path: 'light.qnt', weight: 2 },
    { path: 'a', weight: 4 },
    { path: 'b', weight: 3 },
  ];
  let inventoriesRead = 0;
  const observed = new Proxy(units, {
    get(target, property, receiver) {
      if (property === Symbol.iterator) inventoriesRead++;
      return Reflect.get(target, property, receiver);
    },
  });
  const parts = partsOf(observed, 64);
  expect(inventoriesRead).toBe(1);
  expect(parts).toHaveLength(64);
  expect(parts.flat().toSorted((a, b) => a.path.localeCompare(b.path))).toEqual(
    units.toSorted((a, b) => a.path.localeCompare(b.path))
  );
});

test('batch assignments preserve stable ownership and remain independent snapshots', () => {
  const units: SpecUnit[] = [
    { path: 'heavy.qnt', weight: 8 },
    { path: 'middle.qnt', weight: 5 },
    { path: 'light.qnt', weight: 2 },
    { path: 'a', weight: 4 },
    { path: 'b', weight: 3 },
  ];
  const before = partsOf(units, 2);
  expect(before.map((part) => part.map((unit) => unit.path))).toEqual([
    ['a', 'light.qnt', 'middle.qnt'],
    ['b', 'heavy.qnt'],
  ]);
  expect(Object.isFrozen(before)).toBe(true);
  expect(before.every(Object.isFrozen)).toBe(true);
  units.push({ path: 'c', weight: 1 });
  const after = partsOf(units, 2);
  expect(before.flat()).toHaveLength(5);
  expect(after.flat()).toHaveLength(6);
  expect(units.map((unit) => unit.path)).toEqual([
    'heavy.qnt',
    'middle.qnt',
    'light.qnt',
    'a',
    'b',
    'c',
  ]);
});
