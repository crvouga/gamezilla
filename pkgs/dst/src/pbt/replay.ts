import type { Command } from '../harness/command';
import type { AnyScenarioDef } from '../harness/define-scenario';
import {
  parseRepro,
  REPRO_VERSION,
  type Repro,
  type ReproInputs,
} from '../harness/repro';
import type { World } from '../harness/world-types';
import type { JsonValue } from '../kernel/json';
import type { TraceRecord } from '../kernel/trace';
import { RELIABLE_NETWORK } from '../models/network';
import {
  assertDeterministic,
  formatDeterminismFailure,
  type RunInputs,
} from './assert-deterministic';

function isRepro(inputs: RunInputs | Repro | string): inputs is Repro {
  return (
    typeof inputs === 'object' &&
    inputs !== null &&
    'version' in inputs &&
    (inputs as Repro).version === REPRO_VERSION
  );
}

function fromRepro(r: Repro): RunInputs {
  return {
    seed: r.inputs.seed,
    knobs: r.inputs.knobs,
    commands: r.inputs.commands as Command[],
    networkFaults: r.inputs.networkFaults,
  };
}

function resolveRunInputs(inputs: RunInputs | Repro | string): RunInputs {
  if (typeof inputs === 'string') return fromRepro(parseRepro(inputs));
  if (isRepro(inputs)) return fromRepro(inputs);
  return inputs;
}

/**
 * Replay mode: re-run a Repro (object, JSON string, or raw inputs) with
 * divergence detection on, and format a failure report on mismatch.
 */
export async function replay(
  scenario: AnyScenarioDef,
  inputs: RunInputs | Repro | string
): Promise<{
  readonly world: World;
  readonly repro: Repro<Command>;
  readonly trace: readonly TraceRecord[];
}> {
  const resolved = resolveRunInputs(inputs);
  try {
    return await assertDeterministic(scenario, resolved);
  } catch (e) {
    const repro: Repro<Command> = {
      version: REPRO_VERSION,
      inputs: {
        seed: String(resolved.seed),
        startTime: 0,
        knobs: (resolved.knobs ?? {}) as Record<string, JsonValue>,
        commands: resolved.commands,
        networkFaults:
          resolved.networkFaults ??
          (RELIABLE_NETWORK as ReproInputs['networkFaults']),
      },
      meta: { scenarioId: scenario.id },
    };
    throw new Error(formatDeterminismFailure(repro, [], e), { cause: e });
  }
}
