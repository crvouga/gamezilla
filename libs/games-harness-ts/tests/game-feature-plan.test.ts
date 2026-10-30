import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  readFeatureVariants,
  variantFeatureUnits,
} from '@libs/harness-ts/feature-variants';
import { packageSpecInventory } from '@libs/harness-ts/replay-plans';
import { PART_LOAD, partLoad, partsOf } from '@libs/harness-ts/spec-parts';
import { packageSpecs } from '@libs/harness-ts/spec-sources';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';
import { conformanceVariants, sharedSpecifications } from './conformance-world';

const ROOT = join(import.meta.dirname, '../../..');
const PACKAGE = join(import.meta.dirname, '..');
const plan = readFeatureVariants(PACKAGE)!;
const features = sharedSpecifications().filter((uri) =>
  uri.endsWith('.feature')
);

test('generated feature counts match every game the registry requires', () => {
  expect(plan).toEqual(
    Object.fromEntries(
      features.map((uri) => [basename(uri), conformanceVariants(uri).length])
    )
  );
});

// regression: games-feature-variants-overfill-spec-part
test('the five features in release part 113 retain all 138 cases across bounded parts', () => {
  const failed = [
    ['game-turns.feature', 1, 2],
    ['matched-game-abort.feature', 2, 3],
    ['matched-game-daily-clock.feature', 0, 2],
    ['puzzle-rating.feature', 2, 3],
    ['puzzle-spectator.feature', 0, 2],
  ] as const;
  let previousCases = 0;
  for (const [name, index, count] of failed) {
    const uri = `specs/games/${name}`;
    const source = readFileSync(join(ROOT, uri), 'utf8');
    const scenarios = parseFeature(source, uri).scenarios;
    const variants = conformanceVariants(uri);
    previousCases +=
      scenarios.filter((_, i) => i % count === index).length * variants.length;
    const expected = scenarios.flatMap((_, i) =>
      variants.map((variant) => `${i}:${variant.id}`)
    );
    const actual = variantFeatureUnits(uri, source, plan).flatMap((unit) =>
      scenarios.flatMap((_, i) =>
        i % (unit.slice?.count ?? 1) === (unit.slice?.index ?? 0)
          ? variants.map((variant) => `${i}:${variant.id}`)
          : []
      )
    );
    expect(actual.sort()).toEqual(expected.sort());
  }
  expect(previousCases).toBe(138);
  expect(previousCases).toBeGreaterThan(PART_LOAD);
  const inventory = packageSpecInventory(PACKAGE, packageSpecs(PACKAGE, ROOT));
  const units = inventory(181);
  const parts = partsOf(units, 181);
  expect(units.reduce((sum, unit) => sum + unit.weight, 0)).toBe(5412);
  expect(partLoad(units).load).toBe(5220);
  expect(
    parts
      .flat()
      .map((unit) => JSON.stringify(unit))
      .sort()
  ).toEqual(units.map((unit) => JSON.stringify(unit)).sort());
  for (const part of parts)
    expect(partLoad(part).load).toBeLessThanOrEqual(PART_LOAD);
});

test('every source scenario and game is counted once in the generated feature units', () => {
  for (const uri of features) {
    const source = readFileSync(join(ROOT, uri), 'utf8');
    const count = parseFeature(source, uri).scenarios.length;
    const variants = conformanceVariants(uri).length;
    const units = variantFeatureUnits(uri, source, plan);
    expect(units.reduce((sum, unit) => sum + unit.weight, 0)).toBe(
      count * variants
    );
    for (const unit of units) {
      const cases = Array.from({ length: count }, (_, i) => i).filter(
        (i) => i % (unit.slice?.count ?? 1) === (unit.slice?.index ?? 0)
      );
      expect(unit.weight).toBe(cases.length * variants);
    }
  }
});
