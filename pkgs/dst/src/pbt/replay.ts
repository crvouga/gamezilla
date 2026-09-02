import type { Action } from '../harness/actions';
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
  if (r.inputs.seed === undefined) {
    throw new Error('replay: repro.inputs.seed is required');
  }
  return {
    seed: r.inputs.seed,
    knobs: r.inputs.knobs,
    actions: r.inputs.actions as Action[],
    networkFaults: r.inputs.networkFaults,
  };
}

function resolveRunInputs(inputs: RunInputs | Repro | string): RunInputs {
  if (typeof inputs === 'string') return fromRepro(parseRepro(inputs));
  if (isRepro(inputs)) return fromRepro(inputs);
  return inputs;
}

export async function replay(
  scenario: AnyScenarioDef,
  inputs: RunInputs | Repro | string
): Promise<{
  readonly world: World;
  readonly repro: Repro<Action>;
  readonly trace: readonly TraceRecord[];
}> {
  const resolved = resolveRunInputs(inputs);
  try {
    return await assertDeterministic(scenario, resolved);
  } catch (e) {
    const repro: Repro<Action> = {
      version: REPRO_VERSION,
      inputs: {
        seed: String(resolved.seed),
        startTime: 0,
        knobs: (resolved.knobs ?? {}) as Record<string, JsonValue>,
        actions: resolved.actions,
        networkFaults:
          resolved.networkFaults ??
          (RELIABLE_NETWORK as ReproInputs['networkFaults']),
      },
      meta: { scenarioId: scenario.id },
    };
    throw new Error(formatDeterminismFailure(repro, [], e), { cause: e });
  }
}

export type { RunInputs };
