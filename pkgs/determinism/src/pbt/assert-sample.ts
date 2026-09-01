import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { SystemAction, SystemDef } from '../define-system';
import type { JsonValue } from '../json';
import { playActionsOnWorld, type WorldReal } from '../play';
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

function taggedAction(kind: string, body: JsonValue): SystemAction {
  if (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    'kind' in body
  ) {
    return body as SystemAction;
  }
  return { kind, ...(body as object) } as SystemAction;
}

function buildActionCommands(
  system: SystemDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<AsyncCommand<object, WorldReal<SystemAction>>>[] {
  const roleIds = roleIdsFromKnobs(system, knobs);
  const ctx = { roleIds, knobs };
  const modelHooks = system.model;
  const out: fc.Arbitrary<AsyncCommand<object, WorldReal<SystemAction>>>[] = [];

  const toCmd = (
    action: SystemAction,
    allows: (m: object, a: JsonValue) => boolean,
    apply: (m: object, a: JsonValue) => void
  ): AsyncCommand<object, WorldReal<SystemAction>> => ({
    check: (m) => allows(m, action),
    run: async (m, r) => {
      apply(m, action);
      r.actions.push(action);
    },
    toString: () => JSON.stringify(action),
  });

  for (const lib of system.library ?? []) {
    const allows = lib.allows ?? modelHooks?.allows ?? (() => true);
    const apply = lib.apply ?? modelHooks?.apply ?? (() => undefined);
    out.push(
      lib
        .arb(ctx)
        .map((body) => toCmd(taggedAction(lib.kind, body), allows, apply))
    );
  }

  if (system.domain !== undefined) {
    const allows =
      system.domain.model?.allows ?? modelHooks?.allows ?? (() => true);
    const apply =
      system.domain.model?.apply ?? modelHooks?.apply ?? (() => undefined);
    for (const arb of system.domain.arbs(ctx)) {
      out.push(
        arb.map((op) => toCmd(taggedAction('domain', op), allows, apply))
      );
    }
  }

  if (out.length === 0) {
    throw new Error(`assertSample(${system.id}): no library or domain arbs`);
  }
  return out;
}

async function dispatchAction(
  system: SystemDef,
  world: World,
  action: SystemAction
): Promise<void> {
  for (const lib of system.library ?? []) {
    const hit =
      lib.match !== undefined ? lib.match(action) : action.kind === lib.kind;
    if (hit) {
      await lib.dispatch(world, action);
      return;
    }
  }
  if (system.domain !== undefined) {
    await system.domain.dispatch(world, action);
    return;
  }
  throw new Error(`dispatch: unknown action kind ${action.kind}`);
}

export type AssertSampleOpts = AssertSamplePropertyParams & {
  readonly maxCommands?: number;
};

export async function assertSample<S>(
  system: SystemDef<S>,
  opts?: AssertSampleOpts
): Promise<void> {
  const maxCommands = opts?.maxCommands ?? 14;
  const sys = system as unknown as SystemDef;
  const knobArbs = arbFromKnobDefs(
    system.knobs.map((k) => ({
      id: k.id,
      arb: k.arb as fc.Arbitrary<JsonValue>,
    }))
  );

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
        const real: WorldReal<SystemAction> = {
          clientIds: world.roleIds('client'),
          actions: [],
        };
        const initial =
          system.model?.initial ??
          system.domain?.model?.initial ??
          (() => ({}));
        const model = initial();
        await fc.asyncModelRun(() => ({ model, real }), cmds);
        await playActionsOnWorld({
          host: world,
          actions: real.actions,
          dispatch: (a) => dispatchAction(sys, world as World, a),
          ...(system.prepareConverge !== undefined
            ? { prepareConverge: () => system.prepareConverge!(world) }
            : {}),
        });
        await system.settle(world);
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
    await playActionsOnWorld({
      host: world,
      actions: inputs.actions,
      dispatch: (a) => dispatchAction(sys, world as World, a),
      ...(system.prepareConverge !== undefined
        ? { prepareConverge: () => system.prepareConverge!(world) }
        : {}),
    });
    if (inputs.settle !== false) {
      await system.settle(world);
    }
  } catch (e) {
    // Dispose drains the sim, which can fail too — never let that mask the
    // failure the caller actually needs to see.
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
