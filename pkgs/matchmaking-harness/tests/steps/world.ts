/**
 * The world a matchmaking scenario runs in: the example app's lobby behind
 * three replicas sharing one store (the system checks they agree after every
 * step), opened for the scenario and disposed after its last step. People
 * wait under their own name.
 */

import {
  defineParameterType,
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';
import {
  type MatchmakingHarness,
  matchmaking,
  registerTestCrashHandler,
} from '@pkgs/matchmaking-harness';

export type MatchmakingWorld = {
  readonly ctx: ScenarioContext;
  readonly harness: Run<MatchmakingHarness>;
  readonly disposeCrash: () => void;
  readonly firstWaits: Map<string, string>;
  readonly firstMatches: Map<string, string>;
  readonly awayViews: Map<string, unknown>;
  privateStatus: unknown;
  phase: 'Given' | 'When' | 'Then';
};

export const { Given, When, Then, Step } = stepsFor<MatchmakingWorld>();

/**
 * `{actor}` is a person, matching the spec gate's registry
 * (`SPEC_PARAMETER_TYPES` in `@libs/harness`, which a `pkgs/` package
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
      const harness = await matchmaking.run({
        seed: ctx.testId,
        args: { replicas: 3 },
      });
      return {
        ctx,
        harness,
        disposeCrash,
        firstWaits: new Map(),
        firstMatches: new Map(),
        awayViews: new Map(),
        privateStatus: undefined,
        phase: 'Given',
      };
    },
    record: async (w, step, run) => {
      const keyword = step.keyword.trim();
      if (keyword === 'Given' || keyword === 'When' || keyword === 'Then')
        w.phase = keyword;
      return run();
    },
    dispose: async (w) => {
      await w.harness[Symbol.asyncDispose]();
      w.disposeCrash();
    },
  });
}
