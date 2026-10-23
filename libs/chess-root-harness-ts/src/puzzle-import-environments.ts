import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { defineProductSystem } from '@libs/harness-ts/define-product-system';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { type OpenHarness, openHarness } from '@libs/harness-ts/open-harness';
import { followPuzzleImport } from './puzzle-import-ui';
import { joinPuzzleTeam, readImportPool } from './puzzle-import-world';
import {
  readPuzzleSource,
  reuseLichessFile,
  saveLichessFile,
} from './puzzle-source-ui';

const environments = new WeakMap<
  ProductHarness,
  { run: OpenHarness; before: number; ready: boolean }
>();
export const prepareOtherPuzzleEnvironment = scenarioAction({
  name: 'prepareOtherPuzzleEnvironment',
  act: async (s) => {
    if (environments.has(s)) return;
    const run = await openHarness(
      defineProductSystem(s.harness.composition, {
        sharedDataStore: s.harness.server.blob.withPrefix('shared/'),
      }),
      'other-puzzle-environment'
    );
    s.session.onDispose(() => run[Symbol.asyncDispose]());
    environments.set(s, {
      run,
      before: await run.read(readImportPool),
      ready: false,
    });
  },
});

export const followOtherPuzzleEnvironment = scenarioAction({
  name: 'followOtherPuzzleEnvironment',
  act: async (s) => {
    await Promise.resolve(prepareOtherPuzzleEnvironment.act(s));
    const other = environments.get(s);
    if (!other) throw new Error('Other environment missing');
    if (!other.ready) {
      await other.run.apply(signInWithGoogle, 'alice');
      await other.run.apply(joinPuzzleTeam, 'alice');
      other.ready = true;
    }
    await other.run.apply(followPuzzleImport, 'alice');
  },
});

export async function readOtherPuzzleSource(s: ProductHarness) {
  const other = environments.get(s);
  if (!other) throw new Error('Other environment missing');
  return other.run.read(readPuzzleSource, 'alice');
}

export const refreshOtherPuzzleSource = scenarioAction({
  name: 'refreshOtherPuzzleSource',
  act: async (s) => {
    const other = environments.get(s);
    if (!other) throw new Error('Other environment missing');
    await other.run.apply(reuseLichessFile);
  },
});

export const saveFirstLichessFileElsewhere = scenarioAction({
  name: 'saveFirstLichessFileElsewhere',
  act: async (s) => {
    await Promise.resolve(followOtherPuzzleEnvironment.act(s));
    const other = environments.get(s);
    if (!other) throw new Error('Other environment missing');
    await other.run.apply(saveLichessFile, 'alice');
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
