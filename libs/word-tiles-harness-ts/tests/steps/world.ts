import { SPEC_PARAMETER_TYPES } from '@libs/harness-ts/parameter-types';
import {
  type WordTilesTable,
  wordTilesTableSystem,
} from '@libs/word-tiles-harness-ts/word-tiles-table';
import {
  defineParameterType,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

// Tiles, words, squares and refusals as the scenarios write them.
for (const spec of SPEC_PARAMETER_TYPES) defineParameterType(spec);

type WordTilesWorld = { readonly run: Run<WordTilesTable> };
export const { Given, When, Then } = stepsFor<WordTilesWorld>();

export function useWordTilesWorld(): void {
  setWorld<WordTilesWorld>({
    create: async (ctx) => ({
      run: await wordTilesTableSystem.run({ seed: ctx.testId, report: true }),
    }),
    dispose: (w) => w.run[Symbol.asyncDispose](),
    record: (w, step, fn) =>
      w.run.record({ kind: step.keyword.trim(), title: step.text }, fn),
  });
}
