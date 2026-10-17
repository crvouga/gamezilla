import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';

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

export async function readCustomGameBoard(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get('custom-game-board').isVisible())) return null;
  return new ChessBoardFlows(ui, 'custom-game-board').readProbe();
}
