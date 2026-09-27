/**
 * The world a matchmaking scenario runs in: matchmaking behind three
 * entrances sharing one store, opened for the scenario and disposed after its
 * last step. People are waited for under their own name as the alias.
 */

import {
  defineParameterType,
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import {
  type MatchmakingSim,
  matchmaking,
  registerTestCrashHandler,
} from '@pkgs/matchmaking-sim';
import type { Run } from '@pkgs/sim';

/** How many entrances every scenario's matchmaking has. */
export const ENTRANCE_COUNT = 3;

export type MatchmakingWorld = {
  readonly ctx: ScenarioContext;
  readonly sim: Run<MatchmakingSim>;
  readonly disposeCrash: () => void;
  /** What a step heard back, for a later `Then`. */
  readonly memo: Map<string, unknown>;
};

export const { Given, When, Then } = stepsFor<MatchmakingWorld>();

/** Entrance `n` (1-based, as the scenarios number them). */
export function entrance(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > ENTRANCE_COUNT) {
    throw new Error(`there is no entrance ${String(n)}`);
  }
  return `r${String(n - 1)}`;
}

/**
 * `{actor}` is a person, matching the spec gate's registry
 * (`SPEC_PARAMETER_TYPES` in `@libs/sim-harness`, which a `pkgs/` package
 * cannot import).
 */
defineParameterType({
  name: 'actor',
  regexp: /Alice|Bob|Carol|Dave|Eve/,
  transformer: (name) => name.toLowerCase(),
});

export function useMatchmakingWorld(): void {
  setWorld<MatchmakingWorld>({
    create: async (ctx) => {
      const disposeCrash = registerTestCrashHandler();
      const sim = await matchmaking.run({
        seed: ctx.testId,
        args: { replicas: ENTRANCE_COUNT },
      });
      return { ctx, sim, disposeCrash, memo: new Map() };
    },
    dispose: async (w) => {
      await w.sim[Symbol.asyncDispose]();
      w.disposeCrash();
    },
  });
}
