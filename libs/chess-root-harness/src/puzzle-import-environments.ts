import { scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { ProductHarness } from '@libs/harness/harness';
import { type OpenHarness, openHarness } from '@libs/harness/open-harness';
import { followPuzzleImport } from './puzzle-import-ui';
import { joinPuzzleTeam, readImportPool } from './puzzle-import-world';
import { reuseLichessFile, saveLichessFile } from './puzzle-source-ui';

const environments = new WeakMap<
  ProductHarness,
  { run: OpenHarness; before: number }
>();
export const prepareOtherPuzzleEnvironment = scenarioAction({
  name: 'prepareOtherPuzzleEnvironment',
  act: async (s) => {
    const run = await openHarness(
      defineProductSystem(s.harness.composition, {
        sharedDataStore: s.harness.server.blob.withPrefix('shared/'),
      }),
      'other-puzzle-environment'
    );
    s.session.onDispose(() => run[Symbol.asyncDispose]());
    environments.set(s, { run, before: await run.read(readImportPool) });
  },
});

export const saveLichessFileInAnotherEnvironment = scenarioAction({
  name: 'saveLichessFileInAnotherEnvironment',
  act: async (s) => {
    await Promise.resolve(prepareOtherPuzzleEnvironment.act(s));
    const other = environments.get(s);
    if (!other) throw new Error('Other environment missing');
    await other.run.apply(signInWithGoogle, 'alice');
    await other.run.apply(joinPuzzleTeam, 'alice');
    await other.run.apply(followPuzzleImport, 'alice');
    await other.run.apply(saveLichessFile, 'alice');
    await Promise.resolve(reuseLichessFile.act(s));
  },
});
export async function otherPuzzleEnvironmentUnchanged(
  s: ProductHarness
): Promise<boolean> {
  const other = environments.get(s);
  if (!other) throw new Error('Other environment not prepared');
  return (await other.run.read(readImportPool)) === other.before;
}
