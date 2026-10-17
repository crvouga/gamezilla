import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import {
  chooseCustomGameWithKeyboard,
  listenToCustomGame,
} from './custom-game-accessibility';
import { repeatCustomGameAcknowledgement } from './custom-game-acknowledgement';
import { redeliverCustomGameBotWake } from './custom-game-bot-wakes';
import { attemptCustomGameBoundary } from './custom-game-boundary';
import { changeThroughCustomGameControls } from './custom-game-controls';
import { playCustomGameHistory } from './custom-game-history';
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
  playCustomGameHistory,
  reviewCustomGame,
  attemptCustomGameBoundary,
  repeatCustomGameAcknowledgement,
  redeliverCustomGameBotWake,
  chooseCustomGameWithKeyboard,
  listenToCustomGame,
];
