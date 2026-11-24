import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { setWorld, stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

type ContentWorld = { readonly run: Run<ContentHarness> };
export const { Given, When, Then } = stepsFor<ContentWorld>();

export function useContentWorld(): void {
  setWorld<ContentWorld>({
    create: async (ctx) => ({
      run: await contentSystem.run({ seed: ctx.testId }),
    }),
    dispose: (world) => world.run[Symbol.asyncDispose](),
  });
}
