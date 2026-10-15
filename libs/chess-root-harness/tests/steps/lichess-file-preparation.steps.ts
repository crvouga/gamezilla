import {
  askToStopPuzzleLoading,
  cancelStoppingPuzzleLoading,
  checkLichessFileAgain,
  chooseLichessFile,
  confirmStoppingPuzzleLoading,
  controlLichessFileCheck,
  controlLichessFileSave,
  finishSavingChosenLichessFile,
  reopenLichessFile,
  saveChosenLichessFile,
} from '@libs/chess-root-harness/lichess-file-actions';
import {
  prepareChosenLichessFile,
  prepareSavingLichessFile,
} from '@libs/chess-root-harness/lichess-file-setup';
import { beginCheckingLichessFile } from '@libs/chess-root-harness/puzzle-file-preparation';
import {
  followOtherPuzzleEnvironment,
  saveFirstLichessFileElsewhere,
} from '@libs/chess-root-harness/puzzle-import-environments';
import {
  readPuzzleSource,
  seedSavedLichessFile,
} from '@libs/chess-root-harness/puzzle-source-ui';
import { partition } from '@libs/harness/actions';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given('{actor} is checking for the saved Lichess file', (w) =>
  w.s.apply(beginCheckingLichessFile)
);

Given('checking for the saved Lichess file has not finished', async (w) => {
  await w.s.apply(controlLichessFileCheck, 'hold');
  await w.s.apply(reopenLichessFile);
});
Given('checking for the saved Lichess file fails', async (w) => {
  await w.s.apply(controlLichessFileCheck, 'fail');
  await w.s.apply(checkLichessFileAgain);
});
Given(
  '{actor} could not check for the saved Lichess file',
  async (w, actor: Actor) => {
    await w.s.apply(controlLichessFileCheck, 'fail', actor);
    await w.s.apply(reopenLichessFile, actor);
    await w.s.apply(controlLichessFileCheck, null, actor);
  }
);
Given('checking for the saved Lichess file keeps failing', async (w) => {
  await w.s.apply(controlLichessFileCheck, 'fail');
  await w.s.apply(reopenLichessFile);
});
Given('{actor} has seen the saved Lichess file', async (w, actor: Actor) => {
  await w.s.apply(seedSavedLichessFile);
  w.memo.set(
    'lichess:file-seen',
    (await w.s.read(readPuzzleSource, actor)).filename
  );
});
Given('{actor} has no previous Lichess file check', async (w, actor: Actor) => {
  await w.s.apply(controlLichessFileCheck, 'hold', actor);
  await w.s.apply(reopenLichessFile, actor);
});
Given(
  '{actor} could not check for the saved Lichess file while offline',
  async (w, actor: Actor) => {
    await w.s.apply(partition, actor);
  }
);
Given('{actor} has chosen the first Lichess file', async (w, actor: Actor) => {
  await w.s.apply(prepareChosenLichessFile, false, actor);
});
Given('{actor} is saving the first Lichess file', async (w, actor: Actor) => {
  await w.s.apply(prepareSavingLichessFile, actor);
});
Given(
  '{actor} started saving a Lichess file before any file was saved',
  async (w, actor: Actor) => {
    await w.s.apply(prepareSavingLichessFile, actor);
  }
);
Given(
  'the team has since saved a Lichess file in another environment',
  async (w) => {
    await w.s.apply(saveFirstLichessFileElsewhere);
  }
);
Given(
  '{actor} has chosen a file that is not a Lichess file',
  async (w, actor: Actor) => {
    await w.s.apply(prepareChosenLichessFile, true, actor);
  }
);
Given(
  '{actor} failed to save the chosen Lichess file',
  async (w, actor: Actor) => {
    await w.s.apply(prepareSavingLichessFile, actor);
    await w.s.apply(controlLichessFileSave, 'fail', actor);
    await w.s.apply(controlLichessFileSave, null, actor);
  }
);
Given(
  '{actor} is being asked to confirm stopping the Lichess file save',
  async (w, actor: Actor) => {
    await w.s.apply(prepareSavingLichessFile, actor);
    await w.s.apply(askToStopPuzzleLoading, actor);
  }
);
When('checking for the saved Lichess file finishes', async (w) => {
  await w.s.apply(controlLichessFileCheck, null);
});
When(
  '{actor} checks for the saved Lichess file again',
  async (w, actor: Actor) => {
    await w.s.apply(checkLichessFileAgain, actor);
  }
);
When('{actor} chooses a Lichess file', async (w, actor: Actor) => {
  await w.s.apply(chooseLichessFile, false, actor);
});
When(
  '{actor} starts saving the chosen Lichess file',
  async (w, actor: Actor) => {
    await w.s.apply(controlLichessFileSave, 'hold', actor);
    await w.s.apply(saveChosenLichessFile, actor);
  }
);
When("saving {actor}'s Lichess file finishes", async (w, actor: Actor) => {
  await w.s.apply(controlLichessFileSave, null, actor);
});
When("saving {actor}'s Lichess file fails", async (w, actor: Actor) => {
  await w.s.apply(controlLichessFileSave, 'fail', actor);
});
When('{actor} saves the chosen file', async (w, actor: Actor) => {
  await w.s.apply(finishSavingChosenLichessFile, actor);
});
When('{actor} saves the chosen Lichess file again', async (w, actor: Actor) => {
  await w.s.apply(saveChosenLichessFile, actor);
});
When('{actor} tries to save a Lichess file', async (w, actor: Actor) => {
  await w.s.apply(saveChosenLichessFile, actor);
});
When('the team follows adding puzzles in another environment', async (w) => {
  await w.s.apply(followOtherPuzzleEnvironment);
});

Given(
  '{actor} has stopped saving the chosen Lichess file',
  async (w, actor: Actor) => {
    await w.s.apply(prepareSavingLichessFile, actor);
    await w.s.apply(askToStopPuzzleLoading, actor);
    await w.s.apply(confirmStoppingPuzzleLoading, actor);
    await w.s.apply(controlLichessFileSave, null, actor);
    await w.s.apply(cancelStoppingPuzzleLoading, actor);
  }
);
