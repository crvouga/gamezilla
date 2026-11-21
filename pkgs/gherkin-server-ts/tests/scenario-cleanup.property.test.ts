import { expect, test } from 'bun:test';
import { withScenarioCleanup } from '@pkgs/gherkin-server-ts/scenario-cleanup';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const thrown = fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined));

test('all failing phases survive nested scenario, disposal and report cleanup', async () => {
  await assertProperty(
    'scenario-cleanup-keeps-every-failure',
    fc.asyncProperty(fc.tuple(thrown, thrown, thrown), async (failures) => {
      const calls: string[] = [];
      let caught: unknown;
      try {
        await withScenarioCleanup(
          async () => {
            calls.push('scenario');
            throw failures[0];
          },
          () =>
            withScenarioCleanup(
              async () => {
                calls.push('dispose');
                throw failures[1];
              },
              async () => {
                calls.push('report');
                throw failures[2];
              }
            )
        );
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AggregateError);
      const outer = caught as AggregateError;
      expect(outer.errors[0]).toBe(failures[0]);
      expect(outer.errors[1]).toBeInstanceOf(AggregateError);
      expect((outer.errors[1] as AggregateError).errors).toEqual(
        failures.slice(1)
      );
      expect(calls).toEqual(['scenario', 'dispose', 'report']);
    })
  );
});
