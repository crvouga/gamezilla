import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { SystemAction, SystemDef } from '../define-system';
import type { JsonValue } from '../json';
import { playActions } from '../play';
import type { SimScenario, SimScenarioInputs } from '../scenario';
import { openWorld, type World } from '../world';
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
      const count =
        spec.countFromKnob !== undefined
          ? Number(knobs[spec.countFromKnob] ?? 0)
          : (spec.count ?? 1);
      for (let i = 0; i < count; i += 1) {
        ids.push(spec.idFor?.(i) ?? (count === 1 ? role : `${role}${i}`));
      }
    }
    cache.set(role, ids);
    return ids;
  };
}

type ActionReal = { actions: SystemAction[] };

function buildActionCommands(
  system: SystemDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<AsyncCommand<object, ActionReal>>[] {
  const roleIds = roleIdsFromKnobs(system, knobs);
  const ctx = { roleIds, knobs };
  const out: fc.Arbitrary<AsyncCommand<object, ActionReal>>[] = [];

  for (const actionDef of system.actions) {
    const allows = actionDef.allows ?? (() => true);
    const apply = actionDef.apply ?? (() => undefined);
    out.push(
      actionDef.arb(ctx).map((action) => {
        const a = action as SystemAction;
        return {
          check: (m: object) => allows(m, a),
          run: async (m: object, r: ActionReal) => {
            apply(m, a);
            r.actions.push(a);
          },
          toString: () => JSON.stringify(a),
        };
      })
    );
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

export async function assertSample<S, M extends object = object>(
  system: SystemDef<S, M>,
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
        await using world = await openWorld(system, { seed, knobs });
        const real: ActionReal = { actions: [] };
        const model = modelInitial() as object;
        await fc.asyncModelRun(() => ({ model, real }), cmds);
        await playActions({
          advance: (ms) => world.advance(ms),
          actions: real.actions,
          dispatch: (a) =>
            dispatchAction(sys, world as World, a as SystemAction),
        });
        await world.settle();
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
};

export async function replay<S>(
  system: SystemDef<S>,
  inputs: ReplayInputs
): Promise<{
  readonly world: World<S>;
  readonly scenario: SimScenario<SystemAction>;
}> {
  const sys = system as unknown as SystemDef;
  const world = await openWorld(system, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkDefaults !== undefined
      ? { networkDefaults: inputs.networkDefaults }
      : {}),
  });
  try {
    await playActions({
      advance: (ms) => world.advance(ms),
      actions: inputs.actions,
      dispatch: (a) => dispatchAction(sys, world as World, a as SystemAction),
    });
    if (inputs.settle !== false) {
      await world.settle();
    }
  } catch (e) {
    await world.dispose().catch(() => undefined);
    throw e;
  }
  const scenario: SimScenario<SystemAction> = {
    version: 1,
    inputs: {
      seed: String(inputs.seed),
      startMs: world.startMs,
      knobs: world.knobs.toJSON() as Record<string, JsonValue>,
      actions: inputs.actions,
      networkDefaults: world.networkDefaults,
    },
    meta: {
      appId: system.id,
      seedHex: world.seed.toString(16),
    },
  };
  return { world, scenario };
}

export type FaultPin = {
  readonly name: string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
};

export async function assertFaultPins<S>(
  system: SystemDef<S>,
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
