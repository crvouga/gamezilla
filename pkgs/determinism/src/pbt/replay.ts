import type { AnySystemDef, SystemAction } from '../define-system';
import type { JsonValue } from '../json';
import {
  parseScenario,
  type SimScenario,
  type SimScenarioInputs,
} from '../scenario';
import type { TraceRecord } from '../trace';
import type { World } from '../world';
import {
  assertDeterministic,
  formatDeterminismFailure,
} from './assert-deterministic';

export type ReplayInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
  readonly networkDefaults?: SimScenarioInputs['networkDefaults'];
  readonly settle?: boolean;
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

function resolveReplayInputs(
  inputs: ReplayInputs | SimScenario | string
): ReplayInputs {
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
}

export async function replay(
  system: AnySystemDef,
  inputs: ReplayInputs | SimScenario | string
): Promise<{
  readonly world: World;
  readonly scenario: SimScenario<SystemAction>;
  readonly trace: readonly TraceRecord[];
}> {
  const resolved = resolveReplayInputs(inputs);
  try {
    return await assertDeterministic(system, resolved);
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
    throw new Error(formatDeterminismFailure(scenario, [], e), { cause: e });
  }
}
