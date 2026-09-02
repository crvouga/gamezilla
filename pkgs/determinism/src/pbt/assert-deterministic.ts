import { bindActionKind, type UnboundActionDef } from '../action';
import type { AnySystemDef, SystemAction } from '../define-system';
import type { JsonValue } from '../json';
import { playActions } from '../play';
import {
  captureScenario,
  type SimScenario,
  type SimScenarioInputs,
} from '../scenario';
import {
  createRecordingTrace,
  createReplayingTrace,
  type TraceRecord,
} from '../trace';
import { openWorld, type World } from '../world';

export type DeterministicRunInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
  readonly networkDefaults?: SimScenarioInputs['networkDefaults'];
  readonly settle?: boolean;
};

function boundActions(system: AnySystemDef) {
  return Object.entries(system.actions).map(([kind, def]) =>
    bindActionKind(kind, def as UnboundActionDef)
  );
}

async function playOnWorld(
  system: AnySystemDef,
  world: World,
  actions: readonly SystemAction[],
  settle: boolean
): Promise<void> {
  const defs = boundActions(system);
  await playActions({
    advance: (ms) => world.advance(ms),
    actions,
    dispatch: async (action) => {
      for (const def of defs) {
        if (action.kind === def.kind) {
          await def.dispatch(world, action as never);
          return;
        }
      }
      throw new Error(`dispatch: unknown action kind ${action.kind}`);
    },
    runInvariants: () => system.invariants(world as never),
  });
  if (settle) await world.settle();
}

function buildScenario(
  system: AnySystemDef,
  world: World,
  inputs: DeterministicRunInputs
): SimScenario<SystemAction> {
  return {
    version: 1,
    inputs: {
      seed: String(inputs.seed),
      startMs: world.startMs,
      knobs: world.knobs as Record<string, JsonValue>,
      actions: inputs.actions,
      networkDefaults: world.networkDefaults,
    },
    meta: {
      appId: system.id,
      seedHex: world.seed.toString(16),
    },
  };
}

export async function assertDeterministic(
  system: AnySystemDef,
  inputs: DeterministicRunInputs
): Promise<{
  readonly scenario: SimScenario<SystemAction>;
  readonly trace: readonly TraceRecord[];
  readonly world: World;
}> {
  const settle = inputs.settle !== false;
  const recording = createRecordingTrace();
  await using world1 = await openWorld(system as never, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkDefaults !== undefined
      ? { networkDefaults: inputs.networkDefaults }
      : {}),
    trace: recording,
  });
  await playOnWorld(system, world1 as World, inputs.actions, settle);
  const trace = recording.events();
  const scenario = buildScenario(system, world1 as World, inputs);

  const replaying = createReplayingTrace(trace);
  const world2 = await openWorld(system as never, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkDefaults !== undefined
      ? { networkDefaults: inputs.networkDefaults }
      : {}),
    trace: replaying,
  });
  try {
    await playOnWorld(system, world2 as World, inputs.actions, settle);
    replaying.assertFullyConsumed();
    await world2.dispose().catch(() => undefined);
    const world = await openWorld(system as never, {
      seed: inputs.seed,
      ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
      ...(inputs.networkDefaults !== undefined
        ? { networkDefaults: inputs.networkDefaults }
        : {}),
    });
    await playOnWorld(system, world as World, inputs.actions, settle);
    return { scenario, trace, world: world as World };
  } catch (e) {
    await world2.dispose().catch(() => undefined);
    throw e;
  }
}

/** @internal */
export function formatDeterminismFailure(
  scenario: SimScenario,
  trace: readonly TraceRecord[],
  error: unknown
): string {
  return (
    `determinism failure: ${error instanceof Error ? error.message : String(error)}\n` +
    `scenario:\n${captureScenario(scenario)}\n` +
    `trace events: ${trace.length}`
  );
}
