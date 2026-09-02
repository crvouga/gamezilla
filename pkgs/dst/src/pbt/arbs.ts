import fc from 'fast-check';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { resolveKnobDefs } from '../harness/knobs';
import type { JsonValue } from '../kernel/json';
import { nodeIdsReader } from '../models/node';

/**
 * TODO(dst-audit): these generators consume fast-check, not sim Choices.
 * D5 (Phase 3.2) replaces them with a `GeneratorResolver` over the Choice stream.
 */
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

export function arbCommand(
  scenario: AnyScenarioDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<JsonValue & { readonly kind: string }> {
  const edges = scenario.network?.edges ?? [];
  const nodeIds = nodeIdsReader(scenario.nodes, knobs);
  const ctx = { nodeIds, knobs, edges };
  const arbs = Object.entries(scenario.commands)
    .filter(([, def]) => (def.weight ?? 1) > 0)
    .flatMap(([kind, def]) => {
      const weight = def.weight ?? 1;
      const arb = def.generate(ctx).map((a) => ({
        ...(a as Record<string, JsonValue>),
        kind,
      }));
      return Array.from({ length: weight }, () => arb);
    });
  if (arbs.length === 0) {
    throw new Error(`arbCommand(${scenario.id}): no generatable commands`);
  }
  return fc.oneof(...arbs) as fc.Arbitrary<
    JsonValue & { readonly kind: string }
  >;
}
