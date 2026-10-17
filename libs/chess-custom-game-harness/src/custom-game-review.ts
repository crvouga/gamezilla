import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';

export const reviewCustomGame = scenarioAction({
  name: 'reviewCustomGame',
  act: async (s, actor: string, ply: number) => {
    await openCustomGameScreen(s, actor);
    const ui = await actorUi(s, actor);
    await ui.get('custom-game-review-ply').clear();
    await ui.get('custom-game-review-ply').input(String(ply));
    await ui.get('custom-game-review-seek').tap();
  },
});
