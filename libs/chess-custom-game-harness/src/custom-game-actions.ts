import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { changeThroughCustomGameControls } from './custom-game-controls';
import { reviewCustomGame } from './custom-game-review';

export const openCustomGame = scenarioAction({
  name: 'openCustomGame',
  act: openCustomGameScreen,
});
export const changeCustomGame = scenarioAction({
  name: 'changeCustomGame',
  act: changeThroughCustomGameControls,
});
export const playCustomGamePreset = scenarioAction({
  name: 'playCustomGamePreset',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('custom-game-play-bot').tap();
  },
});

export const CUSTOM_GAME_HARNESS_ACTIONS = [
  openCustomGame,
  changeCustomGame,
  playCustomGamePreset,
  reviewCustomGame,
];
