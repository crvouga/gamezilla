import { expect, test } from 'bun:test';
import { partOf, specUnits } from '@libs/harness/spec-parts';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

test('feature edits retain every unit and never move unrelated specs or model batches', () => {
  assertProperty(
    'ci-stable-spec-ownership',
    fc.property(
      fc.array(fc.integer({ min: 1, max: 100 }), {
        minLength: 1,
        maxLength: 15,
      }),
      fc.integer({ min: 1, max: 64 }),
      (weights, count) => {
        const features = weights.map((weight, index) => ({
          path: `specs/example/feature-${index}.feature`,
          weight,
        }));
        const models = specUnits('specs/example/model.qnt', '', count);
        const units = [...models, ...features];
        const edited = units.map((unit) =>
          unit.path === features[0]!.path
            ? { ...unit, weight: unit.weight * 100 }
            : unit
        );
        const assignments = Array.from({ length: count }, (_, index) => {
          const part = { index, count };
          const before = partOf(units, part);
          const after = partOf(edited, part);
          const identities = (items: typeof before) =>
            items.map((unit) => `${unit.path}:${unit.slice?.index ?? 0}`);
          expect(identities(after)).toEqual(identities(before));
          return identities(after);
        });
        expect(assignments.flat()).toHaveLength(units.length);
        expect(new Set(assignments.flat()).size).toBe(units.length);
      }
    )
  );
});
