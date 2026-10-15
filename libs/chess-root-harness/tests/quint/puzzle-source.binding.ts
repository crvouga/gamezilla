import {
  followPuzzleImport,
  readPuzzleImport,
  startPuzzleLoading,
} from '@libs/chess-root-harness/puzzle-import-ui';
import { joinPuzzleTeam } from '@libs/chess-root-harness/puzzle-import-world';
import {
  noSavedLichessFile,
  readPuzzleSource,
  saveLichessFile,
  seedSavedLichessFile,
} from '@libs/chess-root-harness/puzzle-source-ui';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-source',
  traces: 6,
  maxSteps: 8,
  actions: {
    init: async (w, picks) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(joinPuzzleTeam, 'alice');
      await w.s.apply(followPuzzleImport, 'alice');
      await w.s.apply(
        picks['_saved'] === true ? seedSavedLichessFile : noSavedLichessFile
      );
    },
    saveLichessFile: (w) => w.s.apply(saveLichessFile, 'alice'),
    addPuzzles: (w) => w.s.apply(startPuzzleLoading, 'alice'),
    followAddingPuzzles: (w) => w.s.apply(followPuzzleImport, 'alice'),
    loseConnection: (w) => w.s.apply(partition, 'alice'),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'alice'),
  },
  observe: async (w) => {
    const source = await w.quiet.read(readPuzzleSource, 'alice');
    const job = await w.quiet.read(readPuzzleImport, 'alice');
    return {
      lichessFileSaved: source.saved,
      needsLichessFile: source.needsFile,
      addingPuzzles: job.status === 'adding',
      online: !source.offline,
    };
  },
});
