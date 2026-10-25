import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import { sokobanSystem } from '@libs/sokoban-harness-ts/sokoban-system';
import { setWorld, stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

type SokobanWorld = { readonly run: Run<SokobanHarness> };
export const { Given, When, Then } = stepsFor<SokobanWorld>();

export function useSokobanWorld(): void {
  setWorld<SokobanWorld>({
    create: async (ctx) => ({
      run: await sokobanSystem.run({ seed: ctx.testId, report: true }),
    }),
    dispose: (w) => w.run[Symbol.asyncDispose](),
    record: (w, step, fn) =>
      w.run.record({ kind: step.keyword.trim(), title: step.text }, fn),
  });
}
