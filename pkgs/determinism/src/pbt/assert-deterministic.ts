import type { Command } from '../harness/command';
import type { AnyScenarioDef } from '../harness/define-scenario';
import {
  REPRO_VERSION,
  type Repro,
  type ReproInputs,
  stringifyRepro,
} from '../harness/repro';
import { openWorld } from '../harness/world';
import type { World } from '../harness/world-types';
import type { JsonValue } from '../kernel/json';
import {
  createTraceRecorder,
  createTraceResolver,
  type TraceRecord,
} from '../kernel/trace';

/** Inputs for one reproducible run (shared by `assertDeterministic` and `replay`). */
export type RunInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly commands: readonly Command[];
  readonly networkFaults?: ReproInputs['networkFaults'];
  readonly converge?: boolean;
};

async function applyOnWorld(
  world: World,
  commands: readonly Command[],
  converge: boolean
): Promise<void> {
  await world.apply(commands);
  if (converge) await world.converge();
}

function buildRepro(
  scenario: AnyScenarioDef,
  world: World,
  inputs: RunInputs
): Repro<Command> {
  return {
    version: REPRO_VERSION,
    inputs: {
      seed: String(inputs.seed),
      startTime: world.startTime,
      knobs: world.knobs as Record<string, JsonValue>,
      commands: inputs.commands,
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

/**
 * Record → replay → fresh: run the Commands three times on the same Seed,
 * fail at the first Trace divergence, and hand back the third World.
 */
export async function assertDeterministic(
  scenario: AnyScenarioDef,
  inputs: RunInputs
): Promise<{
  readonly repro: Repro<Command>;
  readonly trace: readonly TraceRecord[];
  readonly world: World;
}> {
  const converge = inputs.converge !== false;
  const recorder = createTraceRecorder();
  await using world1 = await openWorld(scenario as never, {
    ...worldOptions(inputs),
    trace: recorder,
  });
  await applyOnWorld(world1 as World, inputs.commands, converge);
  const trace = recorder.records();
  const repro = buildRepro(scenario, world1 as World, inputs);

  const resolver = createTraceResolver(trace);
  const world2 = await openWorld(scenario as never, {
    ...worldOptions(inputs),
    trace: resolver,
  });
  try {
    await applyOnWorld(world2 as World, inputs.commands, converge);
    resolver.assertFullyConsumed();
    await world2.dispose().catch(() => undefined);
    const world = await openWorld(scenario as never, worldOptions(inputs));
    await applyOnWorld(world as World, inputs.commands, converge);
    return { repro, trace, world: world as World };
  } catch (e) {
    await world2.dispose().catch(() => undefined);
    throw e;
  }
}

/** @internal */
export function formatDeterminismFailure(
  repro: Repro,
  trace: readonly TraceRecord[],
  error: unknown
): string {
  return (
    `determinism failure: ${error instanceof Error ? error.message : String(error)}\n` +
    `repro:\n${stringifyRepro(repro)}\n` +
    `trace records: ${trace.length}`
  );
}
