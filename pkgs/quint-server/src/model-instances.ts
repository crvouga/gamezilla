// @io-wall-ok — read the main module before assigning its host's trace variants.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_TRACES,
  type ModelParameters,
  type QuintBinding,
  traceVariants,
} from '@pkgs/quint-shared/registry';
import {
  instantiateModel,
  modelParameterId,
  modelParameterNames,
} from './model-parameters';
import { quintModuleName } from './model-source';
import { type SimulateResult, simulate } from './simulate';
import {
  ONCE,
  type ReplayPlan,
  replayPlanOf,
  type TraceRun,
} from './trace-runs';

export type ModelInstance = {
  readonly parameters: ModelParameters;
  readonly runs: readonly TraceRun[];
};

/** Group subjects only when they have the exact same fixed model inputs. */
export function modelInstances(input: {
  readonly specPath: string;
  readonly specUri: string;
  readonly model: string;
}): readonly ModelInstance[] {
  const source = readFileSync(input.specPath, 'utf8');
  const module = quintModuleName(input.specPath);
  const parameters = modelParameterNames(source, module);
  const variants = traceVariants({
    model: input.model,
    specUri: input.specUri,
    parameters,
  });
  if (variants === null) {
    instantiateModel(source, module, {});
    return [{ parameters: {}, runs: ONCE }];
  }
  if (variants.length === 0)
    throw new Error(
      `${input.specUri}: no variant the host registers offers what this model shows`
    );
  const ids = new Set<string>();
  const groups = new Map<
    string,
    { parameters: ModelParameters; runs: TraceRun[] }
  >();
  for (const variant of variants) {
    if (ids.has(variant.id))
      throw new Error(
        `${input.specUri}: duplicate model variant ${variant.id}`
      );
    ids.add(variant.id);
    const values = variant.parameters ?? {};
    instantiateModel(source, module, values);
    const key = modelParameterId(values);
    const group = groups.get(key) ?? { parameters: values, runs: [] };
    group.runs.push({ variant });
    groups.set(key, group);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, group]) => group);
}

export type DrawnInstance = ModelInstance & {
  readonly drawn: SimulateResult;
  readonly outDir: string;
};

/** Each input assignment has its own draw, action cover and trace files. */
export function drawModelInstances(input: {
  readonly specPath: string;
  readonly specUri: string;
  readonly model: string;
  readonly binding: QuintBinding<unknown>;
  readonly outDir: string;
}): readonly DrawnInstance[] {
  return modelInstances(input).map((instance) => {
    const id = modelParameterId(instance.parameters);
    const outDir = id === '' ? input.outDir : join(input.outDir, id);
    return {
      ...instance,
      outDir,
      drawn: simulate({
        specPath: input.specPath,
        parameters: instance.parameters,
        traces: input.binding.traces ?? DEFAULT_TRACES,
        maxSteps: input.binding.maxSteps ?? DEFAULT_MAX_STEPS,
        outDir,
      }),
    };
  });
}

/** A parameterized plan preserves the independently selected cover of every draw. */
export function instancesReplayPlan(
  instances: readonly DrawnInstance[],
  binding: QuintBinding<unknown>
): ReplayPlan {
  const first = instances[0];
  if (first === undefined) throw new Error('Cannot plan an empty model matrix');
  if (instances.length === 1 && modelParameterId(first.parameters) === '')
    return replayPlanOf(first.drawn, binding, first.runs);
  return {
    seed: first.drawn.seed,
    instances: instances.map((instance) => ({
      parameters: instance.parameters,
      plan: replayPlanOf(instance.drawn, binding, instance.runs),
    })),
  };
}
