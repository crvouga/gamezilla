import { actorUi, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { bringToFront } from '@libs/harness/system/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core/flows';
import { openCustomGameScreen } from './custom-game-ui';

export const reviewCustomGame = scenarioAction({
  name: 'reviewCustomGame',
  act: async (s, actor: string, ply: number) => {
    await openCustomGameScreen(s, actor);
    const ui = await actorUi(s, actor);
    await ui.get('chess-custom-review-ply').clear();
    await ui.get('chess-custom-review-ply').input(String(ply));
    await ui.get('chess-custom-review-seek').tap();
  },
});

export async function readCustomGameBoard(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get('chess-custom-board').isVisible())) return null;
  return new ChessBoardFlows(ui, 'chess-custom-board').readProbe();
}
