/**
 * The world an index-tuning scenario runs in: one tuning sim, opened fresh
 * for the scenario and disposed after its last step.
 */

import { type IndexTuning, indexTuningSystem } from '@pkgs/db-indexes/sim';
import {
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/sim';

export type TuningWorld = {
  readonly ctx: ScenarioContext;
  readonly sim: Run<IndexTuning>;
};

export const { Given, When, Then } = stepsFor<TuningWorld>();

export function useTuningWorld(): void {
  setWorld<TuningWorld>({
    create: async (ctx) => ({
      ctx,
      sim: await indexTuningSystem.run({ seed: ctx.testId }),
    }),
    dispose: async (w) => {
      await w.sim[Symbol.asyncDispose]();
    },
  });
}
