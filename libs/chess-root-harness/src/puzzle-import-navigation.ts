import {
  leavePuzzleToChessMenu,
  openPuzzleFromSpace,
} from '@libs/chess-puzzle-harness/chess-actions';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';

export const openChessPuzzleDeveloperSettings = scenarioAction({
  name: 'openChessPuzzleDeveloperSettings',
  act: async (s, actor: string) => {
    await Promise.resolve(openPuzzleFromSpace.act(s, actor));
    await Promise.resolve(leavePuzzleToChessMenu.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get('chess-menu-settings').tap();
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
