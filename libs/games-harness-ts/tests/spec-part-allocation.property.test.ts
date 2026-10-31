import { expect, test } from 'bun:test';
import { variantFeatureUnits } from '@libs/harness-ts/feature-variants';
import { PART_LOAD, partLoad, partsOf } from '@libs/harness-ts/spec-parts';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const suites = fc.array(
  fc.record({
    scenarios: fc.integer({ min: 1, max: 18 }),
    variants: fc.integer({ min: 1, max: 14 }),
  }),
  { minLength: 1, maxLength: 20 }
);

test('bounded variant allocation preserves all work deterministically within feasible caps', () => {
  assertProperty(
    'bounded variant allocation preserves all work',
    fc.property(suites, (features) => {
      const units = features.flatMap(({ scenarios, variants }, index) => {
        const path = `generated-${index}.feature`;
        return variantFeatureUnits(path, 'Scenario: a\n'.repeat(scenarios), {
          [path]: variants,
        });
      });
      // Every unit is individually feasible; one available part per unit
      // guarantees capacity while hash collisions still exercise overflow.
      const count = units.length;
      const parts = partsOf(units, count);
      expect(partsOf([...units].reverse(), count)).toEqual(parts);
      expect(
        parts
          .flat()
          .map((unit) => JSON.stringify(unit))
          .sort()
      ).toEqual(units.map((unit) => JSON.stringify(unit)).sort());
      for (const part of parts)
        expect(partLoad(part).load).toBeLessThanOrEqual(PART_LOAD);
    })
  );
});
