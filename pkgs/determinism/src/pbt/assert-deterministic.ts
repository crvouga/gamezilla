import type { SystemAction, SystemDef } from '../define-system';
import type { JsonValue } from '../json';
import { playActions } from '../play';
import {
  captureScenario,
  type SimFailureArtifact,
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

async function playOnWorld<S, F>(
  system: SystemDef<S, object, F>,
  world: World<S, F>,
  actions: readonly SystemAction[],
  settle: boolean
): Promise<void> {
  await playActions({
    advance: (ms) => world.advance(ms),
    actions,
    dispatch: async (a) => {
      for (const def of system.actions) {
        if (a.kind === def.kind) {
          await def.dispatch(world, a);
          return;
        }
      }
      throw new Error(`dispatch: unknown action kind ${a.kind}`);
    },
  });
  if (settle) await world.settle();
}

function buildScenario<S, F>(
  system: SystemDef<S, object, F>,
  world: World<S, F>,
  inputs: DeterministicRunInputs
): SimScenario<SystemAction> {
  return {
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
}

/**
 * Run the scenario twice: record a trace, then replay-validate it.
 * A divergence means consumer code is not a pure function of (seed, knobs, actions).
 */
export async function assertDeterministic<S, M extends object, F>(
  system: SystemDef<S, M, F>,
  inputs: DeterministicRunInputs
): Promise<{
  readonly scenario: SimScenario<SystemAction>;
  readonly trace: readonly TraceRecord[];
}> {
  const settle = inputs.settle !== false;
  const recording = createRecordingTrace();
  await using world1 = await openWorld(system, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkDefaults !== undefined
      ? { networkDefaults: inputs.networkDefaults }
      : {}),
    trace: recording,
  });
  await playOnWorld(system, world1, inputs.actions, settle);
  const trace = recording.getTrace();
  const scenario = buildScenario(system, world1, inputs);

  const replaying = createReplayingTrace(trace);
  await using world2 = await openWorld(system, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
    ...(inputs.networkDefaults !== undefined
      ? { networkDefaults: inputs.networkDefaults }
      : {}),
    trace: replaying,
  });
  await playOnWorld(system, world2, inputs.actions, settle);
  replaying.assertFullyConsumed();
  return { scenario, trace };
}

export function failureArtifact(
  scenario: SimScenario,
  trace: readonly TraceRecord[],
  error: unknown
): SimFailureArtifact {
  return {
    scenario,
    trace,
    error: error instanceof Error ? error.message : String(error),
  };
}

export function formatFailureArtifact(artifact: SimFailureArtifact): string {
  return (
    `determinism failure: ${artifact.error}\n` +
    `scenario:\n${captureScenario(artifact.scenario)}\n` +
    `trace events: ${artifact.trace.length}`
  );
}
