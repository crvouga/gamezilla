import type { SeededRng } from '@pkgs/uuid';
import fc from 'fast-check';

import type { Action, ActionDef, UnboundActionDef } from '../harness/actions';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { openWorld } from '../harness/world';
import type { World } from '../harness/world-types';
import type { JsonValue } from '../kernel/json';

function assertGenerateTotality(
  kind: string,
  arb: fc.Arbitrary<unknown>
): void {
  try {
    const samples = fc.sample(arb, { numRuns: 1 });
    if (samples.length === 0) throw new Error('empty sample');
  } catch {
    throw new Error(
      `check: generate totality violated for action "${kind}" (weight > 0 but empty generator)`
    );
  }
}

export type WalkResult = {
  readonly actions: Action[];
  readonly seed: number | bigint | string;
  readonly knobs: Record<string, JsonValue>;
  readonly swarm?: readonly string[];
  readonly sometimesHits: ReadonlyMap<string, number>;
};

async function resolveWeight<S>(
  weight: UnboundActionDef['weight'],
  surface: S
): Promise<number> {
  const w = weight ?? 1;
  if (typeof w === 'number') return w;
  return w(surface);
}

function pickWeighted(
  rng: SeededRng,
  entries: readonly { readonly kind: string; readonly weight: number }[]
): string {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) throw new Error('walk: no positive-weight actions');
  let r = rng.int(total);
  for (const e of entries) {
    if (r < e.weight) return e.kind;
    r -= e.weight;
  }
  return entries[entries.length - 1]!.kind;
}

export async function walkEpisode(args: {
  readonly scenario: AnyScenarioDef;
  readonly seed: number | bigint | string;
  readonly knobs: Record<string, JsonValue>;
  readonly episodeIndex: number;
  readonly episodeLength: number;
  readonly swarm?: readonly string[];
}): Promise<WalkResult> {
  const { scenario, seed, knobs, episodeIndex, episodeLength, swarm } = args;
  const world = await openWorld(scenario as never, { seed, knobs });
  try {
    const walkRng = world.ports.rng.fork(`walk#${episodeIndex}`);
    const edges = scenario.network?.edges ?? [];
    const nodeIds = (role: string) => world.nodeIds(role);
    const surface = world as unknown as object;
    const bound = Object.entries(scenario.actions).map(([kind, def]) => ({
      kind,
      def,
    }));
    const mask = swarm !== undefined ? new Set(swarm) : null;
    const recorded: Action[] = [];

    for (let step = 0; step < episodeLength; step += 1) {
      const weighted: { kind: string; weight: number }[] = [];
      for (const { kind, def } of bound) {
        if (mask !== null && !mask.has(kind)) continue;
        const w = await resolveWeight(def.weight, surface);
        if (w > 0) weighted.push({ kind, weight: w });
      }
      if (weighted.length === 0) break;

      const kind = pickWeighted(walkRng, weighted);
      const def = scenario.actions[kind]!;
      const arb = def.generate({
        surface: surface as never,
        nodeIds,
        knobs,
        edges,
      });
      assertGenerateTotality(kind, arb as fc.Arbitrary<unknown>);
      const sampleSeed = walkRng.int(1_000_000_000);
      const payload = fc.sample(arb, { seed: sampleSeed, numRuns: 1 })[0];
      const action = {
        ...(payload as Record<string, JsonValue>),
        kind,
      } as Action;
      await world.apply([action]);
      recorded.push(action);
    }

    await world.converge();
    return {
      actions: recorded,
      seed,
      knobs,
      sometimesHits: world.propertyCoverage(),
      ...(swarm !== undefined ? { swarm } : {}),
    };
  } finally {
    await world.dispose();
  }
}

export function bindActionDefs(scenario: AnyScenarioDef): ActionDef[] {
  return Object.entries(scenario.actions).map(([kind, def]) => ({
    kind,
    ...def,
  }));
}

export type { World };
