import {
  leavePuzzleForGameChoices,
  openGamePuzzles,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { reopenSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { CHESS_GAME_ID } from './chess-playable';
import { readPuzzleSource, saveLichessFile } from './puzzle-source-ui';

export const openChessPuzzleDeveloperSettings = scenarioAction({
  name: 'openChessPuzzleDeveloperSettings',
  act: async (s, actor: string) => {
    await Promise.resolve(openGamePuzzles.act(s, actor, CHESS_GAME_ID));
    await Promise.resolve(leavePuzzleForGameChoices.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get('game-choice-settings').tap();
    await ui.get('chess-settings-developer').tap();
  },
});
export const openChessPuzzleLoader = scenarioAction({
  name: 'openChessPuzzleLoader',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('chess-developer-puzzles').tap();
    await ui.get('puzzle-load-content').expect.visible();
  },
});

/** Exercise file selection from the loader embedded in a space. */
export const saveLichessFileFromSpace = scenarioAction({
  name: 'saveLichessFileFromSpace',
  act: async (s, actor: string, spaceLink: string) => {
    if (!(await readPuzzleSource(s, actor)).offline) {
      await Promise.resolve(reopenSpaceLink.act(s, actor, spaceLink));
      await Promise.resolve(openChessPuzzleDeveloperSettings.act(s, actor));
      await Promise.resolve(openChessPuzzleLoader.act(s, actor));
    }
    await Promise.resolve(saveLichessFile.act(s, actor));
  },
});
