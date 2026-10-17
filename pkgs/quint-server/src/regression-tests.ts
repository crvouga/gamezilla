import { test } from 'bun:test';
import { decodeItfTrace } from '@pkgs/quint-shared/itf';
import type { QuintBinding } from '@pkgs/quint-shared/registry';
import { quintWorld } from '@pkgs/quint-shared/registry';
import { replayTrace } from '@pkgs/quint-shared/replay';
import type { RunModelOptions } from './bun-test';
import type { RecordObligation } from './model-evidence';
import { decide } from './model-evidence';
import type { TraceRun } from './trace-runs';
import { runContext, runName, runObligation } from './trace-runs';

/** Pinned histories share the model's world, assertions, evidence and sharding. */
export function registerRegressionTraces(input: {
  readonly options: RunModelOptions;
  readonly binding: QuintBinding<unknown>;
  readonly mine: (index: number) => boolean;
  readonly record: RecordObligation;
  /** The model's runs: each replays every pinned history. */
  readonly runs: readonly TraceRun[];
}): void {
  for (const [index, regression] of (
    input.binding.regressions ?? []
  ).entries()) {
    if (!input.mine(index)) continue;
    for (const run of input.runs) {
      const body = () =>
        decide({
          record: input.record,
          id: runObligation(`regression:${regression.id}`, run),
          layer: 'implementation',
          body: async () => {
            await replayTrace({
              ctx: runContext(
                {
                  packageName: input.options.packageName,
                  specUri: input.options.specUri,
                  model: input.binding.model,
                  trace: index + 1,
                  seed: regression.seed,
                  testId: `${input.binding.model}.${regression.id}`,
                  title: regression.title,
                },
                run
              ),
              trace: decodeItfTrace(regression.itf),
              world: quintWorld(),
              binding: input.binding,
            });
            return 'the product agreed with the pinned history at every step';
          },
        });
      const name = runName(
        `regression ${regression.id}: ${regression.title}`,
        run
      );
      if (input.binding.timeoutMs === undefined) test(name, body);
      else test(name, body, input.binding.timeoutMs);
    }
  }
}
