import fc from 'fast-check';
import type { AnySystemDef } from '../define-system';
import type { JsonValue } from '../json';
import { resolveKnobDefs } from '../knobs';
import { idsFromKnobs } from './role-ids';

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbKnobs(
  system: AnySystemDef
): fc.Arbitrary<Record<string, JsonValue>> {
  const defs = resolveKnobDefs(system.knobs);
  const entries = defs.map((d) =>
    fc.tuple(fc.constant(d.id), d.arb as fc.Arbitrary<JsonValue>)
  );
  if (entries.length === 0) return fc.constant({});
  return fc
    .tuple(...entries)
    .map((pairs) => Object.fromEntries(pairs) as Record<string, JsonValue>);
}

export function arbAction(
  system: AnySystemDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<JsonValue & { readonly kind: string }> {
  const edges = system.network?.edges ?? [];
  const ids = idsFromKnobs(system, knobs);
  const ctx = { ids, knobs, edges };
  const arbs = Object.entries(system.actions)
    .filter(([, def]) => (def.weight ?? 1) > 0)
    .flatMap(([kind, def]) => {
      const weight = def.weight ?? 1;
      const arb = def.arb(ctx).map((a) => ({
        ...(a as Record<string, JsonValue>),
        kind,
      }));
      return Array.from({ length: weight }, () => arb);
    });
  if (arbs.length === 0) {
    throw new Error(`arbAction(${system.id}): no sampleable actions`);
  }
  return fc.oneof(...arbs) as fc.Arbitrary<
    JsonValue & { readonly kind: string }
  >;
}

export { fc };
