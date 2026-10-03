import { test } from 'bun:test';

import type { RunModelOptions } from './bun-test';
import { decodeItfTrace } from './itf';
import { decide, type RecordObligation } from './model-evidence';
import { type QuintBinding, quintWorld } from './registry';
import { replayTrace } from './replay';

/** Pinned histories share the model's world, assertions, evidence and sharding. */
export function registerRegressionTraces(input: {
  readonly options: RunModelOptions;
  readonly binding: QuintBinding<unknown>;
  readonly mine: (index: number) => boolean;
  readonly record: RecordObligation;
}): void {
  for (const [index, regression] of (
    input.binding.regressions ?? []
  ).entries()) {
    if (!input.mine(index)) continue;
    const body = () =>
      decide({
        record: input.record,
        id: `regression:${regression.id}`,
        layer: 'implementation',
        body: async () => {
          await replayTrace({
            ctx: {
              packageName: input.options.packageName,
              specUri: input.options.specUri,
              model: input.binding.model,
              trace: index + 1,
              seed: regression.seed,
              testId: `${input.binding.model}.${regression.id}`,
              title: regression.title,
            },
            trace: decodeItfTrace(regression.itf),
            world: quintWorld(),
            binding: input.binding,
          });
          return 'the product agreed with the pinned history at every step';
        },
      });
    const name = `regression ${regression.id}: ${regression.title}`;
    if (input.binding.timeoutMs === undefined) test(name, body);
    else test(name, body, input.binding.timeoutMs);
  }
}
