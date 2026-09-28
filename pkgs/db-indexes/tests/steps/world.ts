/**
 * The world an index-tuning scenario runs in: one tuning harness, opened fresh
 * for the scenario and disposed after its last step.
 */

import { type IndexTuning, indexTuningSystem } from '@pkgs/db-indexes/harness';
import {
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

export type TuningWorld = {
  readonly ctx: ScenarioContext;
  readonly harness: Run<IndexTuning>;
};

export const { Given, When, Then } = stepsFor<TuningWorld>();

export function useTuningWorld(): void {
  setWorld<TuningWorld>({
    create: async (ctx) => ({
      ctx,
      harness: await indexTuningSystem.run({ seed: ctx.testId }),
    }),
    dispose: async (w) => {
      await w.harness[Symbol.asyncDispose]();
    },
  });
}
