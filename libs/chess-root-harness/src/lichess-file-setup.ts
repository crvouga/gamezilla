import { scenarioAction } from '@libs/harness/actor-ui';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import {
  chooseLichessFile,
  controlLichessFileSave,
  saveChosenLichessFile,
} from './lichess-file-actions';
import { followOtherPuzzleEnvironment } from './puzzle-import-environments';
import {
  openChessPuzzleDeveloperSettings,
  openChessPuzzleLoader,
} from './puzzle-import-navigation';
import { noSavedLichessFile } from './puzzle-source-ui';

export const prepareChosenLichessFile = scenarioAction({
  name: 'prepareChosenLichessFile',
  act: async (s, invalid: boolean = false, actor: string = 'alice') => {
    await Promise.resolve(noSavedLichessFile.act(s));
    await Promise.resolve(chooseLichessFile.act(s, invalid, actor));
  },
});

export const prepareSavingLichessFile = scenarioAction({
  name: 'prepareSavingLichessFile',
  act: async (s, actor: string = 'alice', spaceLink?: string) => {
    await Promise.resolve(prepareChosenLichessFile.act(s, false, actor));
    if (spaceLink !== undefined) {
      await Promise.resolve(reopenSpaceLink.act(s, actor, spaceLink));
      await Promise.resolve(openChessPuzzleDeveloperSettings.act(s, actor));
      await Promise.resolve(openChessPuzzleLoader.act(s, actor));
      await Promise.resolve(chooseLichessFile.act(s, false, actor));
    }
    await Promise.resolve(followOtherPuzzleEnvironment.act(s));
    await Promise.resolve(controlLichessFileSave.act(s, 'hold', actor));
    await Promise.resolve(saveChosenLichessFile.act(s, actor));
  },
});
