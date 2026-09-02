import fc from 'fast-check';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { resolveKnobDefs } from '../harness/knobs';
import type { JsonValue } from '../kernel/json';

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbKnobs(
  scenario: AnyScenarioDef
): fc.Arbitrary<Record<string, JsonValue>> {
  const defs = resolveKnobDefs(scenario.knobs);
  const entries = defs.map((d) =>
    fc.tuple(fc.constant(d.id), d.arb as fc.Arbitrary<JsonValue>)
  );
  if (entries.length === 0) return fc.constant({});
  return fc
    .tuple(...entries)
    .map((pairs) => Object.fromEntries(pairs) as Record<string, JsonValue>);
}
