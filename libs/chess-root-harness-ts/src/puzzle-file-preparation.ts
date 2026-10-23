import { partition } from '@libs/harness-ts/actions';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  askToStopPuzzleLoading,
  chooseLichessFile,
  controlLichessFileCheck,
  controlLichessFileSave,
  readStopPuzzleChoice,
  reopenLichessFile,
  saveChosenLichessFile,
} from './lichess-file-actions';
import { followPuzzleImport, readPuzzleImport } from './puzzle-import-ui';
import { joinPuzzleTeam } from './puzzle-import-world';
import {
  noSavedLichessFile,
  readPuzzleSource,
  seedSavedLichessFile,
} from './puzzle-source-ui';

export const prepareLichessFileCheck = scenarioAction({
  name: 'prepareLichessFileCheck',
  act: async (s, initialChoice: string) => {
    await Promise.resolve(signInWithGoogle.act(s, 'alice'));
    await Promise.resolve(joinPuzzleTeam.act(s, 'alice'));
    await Promise.resolve(followPuzzleImport.act(s, 'alice'));
    await Promise.resolve(
      (initialChoice === 'saved'
        ? seedSavedLichessFile
        : noSavedLichessFile
      ).act(s)
    );
    if (
      initialChoice === 'chosen' ||
      initialChoice === 'saving' ||
      initialChoice === 'confirming'
    ) {
      await Promise.resolve(chooseLichessFile.act(s));
      if (initialChoice === 'chosen') return;
      await Promise.resolve(controlLichessFileSave.act(s, 'hold'));
      await Promise.resolve(controlLichessFileCheck.act(s, 'hold'));
      await Promise.resolve(saveChosenLichessFile.act(s));
      if (initialChoice === 'confirming')
        await Promise.resolve(askToStopPuzzleLoading.act(s));
      return;
    }
    await Promise.resolve(controlLichessFileCheck.act(s, 'hold'));
    await Promise.resolve(reopenLichessFile.act(s));
  },
});

export const beginCheckingLichessFile = scenarioAction({
  name: 'beginCheckingLichessFile',
  act: async (s) => {
    await Promise.resolve(controlLichessFileCheck.act(s, 'hold'));
    const ui = await actorUi(s, 'alice');
    if (await ui.get('puzzle-source-checking').isVisible()) return;
    if (await ui.get('puzzle-source-recheck').isVisible())
      await ui.get('puzzle-source-recheck').tap();
    else await Promise.resolve(reopenLichessFile.act(s));
  },
});

export const beginReturningToLichessFile = scenarioAction({
  name: 'beginReturningToLichessFile',
  act: async (s) => {
    await Promise.resolve(controlLichessFileCheck.act(s, 'hold'));
    await Promise.resolve(reopenLichessFile.act(s));
  },
});

export const failSavingLichessFile = scenarioAction({
  name: 'failSavingLichessFile',
  act: async (s) => {
    await Promise.resolve(controlLichessFileSave.act(s, 'fail'));
    await Promise.resolve(controlLichessFileCheck.act(s, 'fail'));
    await s.session.waitForIdle();
    await Promise.resolve(controlLichessFileSave.act(s, null));
    await Promise.resolve(controlLichessFileCheck.act(s, null));
  },
});

export const losePuzzleLoadingConnection = scenarioAction({
  name: 'losePuzzleLoadingConnection',
  act: async (s) => {
    await Promise.resolve(partition.act(s, 'alice'));
    await s.session.advanceTime(1000);
  },
});

/** Translation of the actual file, progress and confirmation controls. */
export async function readLichessFilePreparation(s: ProductHarness) {
  const source = await readPuzzleSource(s);
  const choice = await readStopPuzzleChoice(s);
  const addition = await readPuzzleImport(s);
  return {
    lichessFile: {
      check: source.checking
        ? 'checking'
        : source.checkFailed
          ? 'failed'
          : source.checkOffline
            ? 'offline'
            : 'known',
      save: source.saving
        ? 'saving'
        : source.saveError?.includes('Saving stopped')
          ? 'stopped'
          : source.saveFailed
            ? 'failed'
            : 'idle',
      chosen: source.chosen,
      available: source.saved,
      confirmingStop: choice.confirming,
      needsFile: source.needsFile,
    },
    addingPuzzles: addition.status === 'adding',
    online: !source.offline,
  };
}
