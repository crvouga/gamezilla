import { scenarioAction } from '@libs/harness/actor-ui';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { ProductHarness } from '@libs/harness/harness';
import { type OpenHarness, openHarness } from '@libs/harness/open-harness';
import { readImportPool } from './puzzle-import-world';

const environments = new WeakMap<
  ProductHarness,
  { run: OpenHarness; before: number }
>();
export const prepareOtherPuzzleEnvironment = scenarioAction({
  name: 'prepareOtherPuzzleEnvironment',
  act: async (s) => {
    const run = await openHarness(
      defineProductSystem(s.harness.composition),
      'other-puzzle-environment'
    );
    s.session.onDispose(() => run[Symbol.asyncDispose]());
    environments.set(s, { run, before: await run.read(readImportPool) });
  },
});
export async function otherPuzzleEnvironmentUnchanged(
  s: ProductHarness
): Promise<boolean> {
  const other = environments.get(s);
  if (!other) throw new Error('Other environment not prepared');
  return (await other.run.read(readImportPool)) === other.before;
}
