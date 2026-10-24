import type { NumberlinkHarness } from '@libs/numberlink-harness-ts/numberlink-system';
import { numberlinkSystem } from '@libs/numberlink-harness-ts/numberlink-system';
import { setWorld, stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

type NumberlinkWorld = { readonly run: Run<NumberlinkHarness> };
export const { Given, When, Then } = stepsFor<NumberlinkWorld>();

export function useNumberlinkWorld(): void {
  setWorld<NumberlinkWorld>({
    create: async (ctx) => ({
      run: await numberlinkSystem.run({ seed: ctx.testId, report: true }),
    }),
    dispose: (w) => w.run[Symbol.asyncDispose](),
    record: (w, step, fn) =>
      w.run.record({ kind: step.keyword.trim(), title: step.text }, fn),
  });
}
