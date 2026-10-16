import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import {
  configureCustomGame,
  sendCustomGameChoice,
} from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameChoice } from '@libs/game-session-shared/custom-game-choice';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import {
  chooseCustomGameWithKeyboard,
  listenToCustomGame,
} from './custom-game-accessibility';
import { repeatCustomGameAcknowledgement } from './custom-game-acknowledgement';
import { chooseCustomGameBotMove } from './custom-game-bot-choice';
import { redeliverCustomGameBotWake } from './custom-game-bot-wakes';
import { attemptCustomGameBoundary } from './custom-game-boundary';
import { changeThroughCustomGameControls } from './custom-game-controls';
import { playCustomGameHistory } from './custom-game-history';
import { raceCustomGameChoices } from './custom-game-race';
import { reviewCustomGame } from './custom-game-review';

export const openCustomGame = scenarioAction({
  name: 'openCustomGame',
  act: openCustomGameScreen,
});
export const changeCustomGame = scenarioAction({
  name: 'changeCustomGame',
  act: changeThroughCustomGameControls,
});
export const establishCustomGame = scenarioAction({
  name: 'establishCustomGame',
  act: configureCustomGame,
});
export const attemptCustomGameChoice = scenarioAction({
  name: 'attemptCustomGameChoice',
  act: (s, actor: string, choice: CustomGameChoice) =>
    sendCustomGameChoice(s, actor, choice).then(() => undefined),
});
export const playCustomGamePreset = scenarioAction({
  name: 'playCustomGamePreset',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('chess-custom-play-bot').tap();
  },
});

export const CUSTOM_GAME_HARNESS_ACTIONS = [
  openCustomGame,
  changeCustomGame,
  establishCustomGame,
  attemptCustomGameChoice,
  playCustomGamePreset,
  playCustomGameHistory,
  raceCustomGameChoices,
  reviewCustomGame,
  attemptCustomGameBoundary,
  repeatCustomGameAcknowledgement,
  chooseCustomGameBotMove,
  redeliverCustomGameBotWake,
  chooseCustomGameWithKeyboard,
  listenToCustomGame,
];
