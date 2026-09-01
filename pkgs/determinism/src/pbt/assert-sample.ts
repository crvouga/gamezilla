import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { SystemAction, SystemDef } from '../define-system';
import { resolveNodeCount } from '../define-system';
import type { JsonValue } from '../json';
import { playActions } from '../play';
import {
  parseScenario,
  type SimScenario,
  type SimScenarioInputs,
} from '../scenario';
import type { TraceRecord } from '../trace';
import { openWorld, type World } from '../world';
import {
  assertDeterministic,
  failureArtifact,
  formatFailureArtifact,
} from './assert-deterministic';
import {
  type AssertSamplePropertyParams,
  arbFromKnobDefs,
  arbWorldSeed,
  assertSampleProperty,
} from './assert-property';

function roleIdsFromKnobs(
  system: SystemDef,
  knobs: Record<string, JsonValue>
): (role: string) => readonly string[] {
  const cache = new Map<string, string[]>();
  return (role: string) => {
    const hit = cache.get(role);
    if (hit !== undefined) return hit;
    const ids: string[] = [];
    for (const spec of system.nodes) {
      if (spec.role !== role) continue;
      const count = resolveNodeCount(spec.count, (id) => knobs[id]);
      for (let i = 0; i < count; i += 1) {
        ids.push(spec.idFor?.(i) ?? (count === 1 ? role : `${role}${i}`));
      }
    }
    cache.set(role, ids);
    return ids;
  };
}

type ActionReal = { actions: SystemAction[] };

/** Weight library chaos lighter than domain so PBT spends more time on domain ops. */
const CLASS_WEIGHT: Record<'library' | 'domain', number> = {
  library: 1,
  domain: 3,
};

function buildActionCommands(
  system: SystemDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<AsyncCommand<object, ActionReal>>[] {
  const roleIds = roleIdsFromKnobs(system, knobs);
  const edges = system.network?.edges ?? [];
  const ctx = { roleIds, knobs, edges };
  const out: fc.Arbitrary<AsyncCommand<object, ActionReal>>[] = [];

  for (const actionDef of system.actions) {
    const allows = actionDef.allows ?? (() => true);
    const apply = actionDef.apply ?? (() => undefined);
    const weight = CLASS_WEIGHT[actionDef.class];
    const cmdArb = actionDef.arb(ctx).map((action) => {
      const a = action as SystemAction;
      return {
        check: (m: object) => allows(m, a),
        run: async (m: object, r: ActionReal) => {
          apply(m, a);
          r.actions.push(a);
        },
        toString: () => JSON.stringify(a),
      };
    });
    for (let i = 0; i < weight; i += 1) {
      out.push(cmdArb);
    }
  }

  if (out.length === 0) {
    throw new Error(`assertSample(${system.id}): actions must be non-empty`);
  }
  return out;
}

async function dispatchAction(
  system: SystemDef,
  world: World,
  action: SystemAction
): Promise<void> {
  for (const def of system.actions) {
    if (action.kind === def.kind) {
      await def.dispatch(world, action);
      return;
    }
  }
  throw new Error(`dispatch: unknown action kind ${action.kind}`);
}

export type AssertSampleOpts = AssertSamplePropertyParams & {
  readonly maxCommands?: number;
};

export async function assertSample<S, M extends object = object, F = unknown>(
  system: SystemDef<S, M, F>,
  opts?: AssertSampleOpts
): Promise<void> {
  if (system.model === undefined) {
    throw new Error(`assertSample(${system.id}): model is required`);
  }
  if (system.actions.length === 0) {
    throw new Error(`assertSample(${system.id}): actions must be non-empty`);
  }
  const maxCommands = opts?.maxCommands ?? 14;
  const sys = system as unknown as SystemDef;
  const knobArbs = arbFromKnobDefs(
    system.knobs.map((k) => ({
      id: k.id,
      arb: k.arb as fc.Arbitrary<JsonValue>,
    }))
  );
  const modelInitial = system.model.initial;

  await assertSampleProperty(
    system.id,
    fc.asyncProperty(
      fc.tuple(arbWorldSeed(), knobArbs).chain(([seed, knobs]) => {
        const cmds = fc.commands(buildActionCommands(sys, knobs), {
          maxCommands,
          size: 'small',
        });
        return fc.tuple(fc.constant(seed), fc.constant(knobs), cmds);
      }),
      async ([seed, knobs, cmds]) => {
        // Model phase first (no world boot) — collect the action list.
        const real: ActionReal = { actions: [] };
        const model = modelInitial() as object;
        await fc.asyncModelRun(() => ({ model, real }), cmds);

        await using world = await openWorld(system, { seed, knobs });
        await playActions({
          advance: (ms) => world.advance(ms),
          actions: real.actions,
          dispatch: (a) =>
            dispatchAction(sys, world as World, a as SystemAction),
        });
        await world.settle();

        // Determinism gate on the collected scenario.
        await assertDeterministic(system, {
          seed,
          knobs,
          actions: real.actions,
        });
      }
    ),
    opts
  );
}

export type ReplayInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
  readonly networkDefaults?: SimScenarioInputs['networkDefaults'];
  readonly settle?: boolean;
  /** Optional recorded trace to validate against during the run. */
  readonly trace?: readonly TraceRecord[];
};

function isScenario(
  inputs: ReplayInputs | SimScenario | string
): inputs is SimScenario {
  return (
    typeof inputs === 'object' &&
    inputs !== null &&
    'version' in inputs &&
    (inputs as SimScenario).version === 1
  );
}

export async function replay<S, F = unknown>(
  system: SystemDef<S, object, F>,
  inputs: ReplayInputs | SimScenario | string
): Promise<{
  readonly world: World<S, F>;
  readonly scenario: SimScenario<SystemAction>;
  readonly trace: readonly TraceRecord[];
}> {
  const resolved: ReplayInputs = (() => {
    if (typeof inputs === 'string') {
      const s = parseScenario(inputs);
      return {
        seed: s.inputs.seed,
        knobs: s.inputs.knobs,
        actions: s.inputs.actions as SystemAction[],
        networkDefaults: s.inputs.networkDefaults,
      };
    }
    if (isScenario(inputs)) {
      return {
        seed: inputs.inputs.seed,
        knobs: inputs.inputs.knobs,
        actions: inputs.inputs.actions as SystemAction[],
        networkDefaults: inputs.inputs.networkDefaults,
      };
    }
    return inputs;
  })();

  try {
    const { scenario, trace } = await assertDeterministic(system, resolved);
    // Re-open for the caller to inspect (gate already disposed its worlds).
    const world = await openWorld(system, {
      seed: resolved.seed,
      ...(resolved.knobs !== undefined ? { knobs: resolved.knobs } : {}),
      ...(resolved.networkDefaults !== undefined
        ? { networkDefaults: resolved.networkDefaults }
        : {}),
    });
    try {
      await playActions({
        advance: (ms) => world.advance(ms),
        actions: resolved.actions,
        dispatch: (a) =>
          dispatchAction(
            system as unknown as SystemDef,
            world as World,
            a as SystemAction
          ),
      });
      if (resolved.settle !== false) {
        await world.settle();
      }
    } catch (e) {
      await world.dispose().catch(() => undefined);
      throw e;
    }
    return { world, scenario, trace };
  } catch (e) {
    const scenario: SimScenario<SystemAction> = {
      version: 1,
      inputs: {
        seed: String(resolved.seed),
        startMs: 0,
        knobs: (resolved.knobs ?? {}) as Record<string, JsonValue>,
        actions: resolved.actions,
        networkDefaults:
          resolved.networkDefaults ??
          ({
            oneWayDelayMeanMs: 0,
            oneWayDelayJitterMs: 0,
            packetLossProbability: 0,
            duplicateProbability: 0,
            reorderWindowMs: 0,
            partitionProbability: 0,
            unpartitionProbability: 0,
          } as SimScenarioInputs['networkDefaults']),
      },
      meta: { appId: system.id },
    };
    throw new Error(formatFailureArtifact(failureArtifact(scenario, [], e)), {
      cause: e,
    });
  }
}

export type FaultPin = {
  readonly name: string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
};

export async function assertFaultPins<S, F = unknown>(
  system: SystemDef<S, object, F>,
  pins: readonly FaultPin[],
  opts?: AssertSamplePropertyParams
): Promise<void> {
  for (const pin of pins) {
    await assertSampleProperty(
      `${system.id}:${pin.name}`,
      fc.asyncProperty(arbWorldSeed(), async (seed) => {
        const { world } = await replay(system, {
          seed,
          ...(pin.knobs !== undefined ? { knobs: pin.knobs } : {}),
          actions: pin.actions,
        });
        await world.dispose();
      }),
      opts
    );
  }
}
