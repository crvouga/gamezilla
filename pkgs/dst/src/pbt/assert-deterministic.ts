import type { Action } from '../harness/actions';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { REPRO_VERSION, type Repro, type ReproInputs } from '../harness/repro';
import { openWorld } from '../harness/world';
import type { World } from '../harness/world-types';
import type { JsonValue } from '../kernel/json';
import type { TraceRecord } from '../kernel/trace';
import { createTraceRecorder, createTraceResolver } from '../kernel/trace';

export type RunInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly Action[];
  readonly networkFaults?: ReproInputs['networkFaults'];
  readonly converge?: boolean;
};

async function applyOnWorld(
  world: World,
  actions: readonly Action[],
  converge: boolean
): Promise<void> {
  await world.apply(actions);
  if (converge) await world.converge();
}

function buildRepro(
  scenario: AnyScenarioDef,
  world: World,
  inputs: RunInputs
): Repro<Action> {
  return {
    version: REPRO_VERSION,
    inputs: {
      seed: String(inputs.seed),
      startTime: world.startTime,
      knobs: world.knobs as Record<string, JsonValue>,
      actions: inputs.actions,
      networkFaults: world.networkFaults,
    },
    meta: {
      scenarioId: scenario.id,
      seedHex: world.seed.toString(16),
    },
  };
}

function worldOptions(inputs: RunInputs) {
  return {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkFaults !== undefined
      ? { networkFaults: inputs.networkFaults }
      : {}),
  };
}

export async function assertDeterministic(
  scenario: AnyScenarioDef,
  inputs: RunInputs
): Promise<{
  readonly repro: Repro<Action>;
  readonly trace: readonly TraceRecord[];
  readonly world: World;
}> {
  const converge = inputs.converge !== false;
  const recorder = createTraceRecorder();
  const world1 = await openWorld(scenario as never, {
    ...worldOptions(inputs),
    trace: recorder,
  });
  let repro: Repro<Action>;
  let trace: readonly TraceRecord[];
  try {
    await applyOnWorld(world1 as World, inputs.actions, converge);
    trace = recorder.records();
    repro = buildRepro(scenario, world1 as World, inputs);
  } finally {
    await world1.dispose();
  }

  const resolver = createTraceResolver(trace);
  const world2 = await openWorld(scenario as never, {
    ...worldOptions(inputs),
    trace: resolver,
  });
  try {
    await applyOnWorld(world2 as World, inputs.actions, converge);
    resolver.assertFullyConsumed();
    await world2.dispose().catch(() => undefined);
    const world = await openWorld(scenario as never, worldOptions(inputs));
    await applyOnWorld(world as World, inputs.actions, converge);
    return { repro, trace, world: world as World };
  } catch (e) {
    await world2.dispose().catch(() => undefined);
    throw e;
  }
}

export function formatDeterminismFailure(
  repro: Repro,
  trace: readonly TraceRecord[],
  error: unknown
): string {
  return (
    `determinism failure: ${error instanceof Error ? error.message : String(error)}\n` +
    `trace records: ${trace.length}\n` +
    `scenario: ${repro.meta.scenarioId ?? 'unknown'}`
  );
}
