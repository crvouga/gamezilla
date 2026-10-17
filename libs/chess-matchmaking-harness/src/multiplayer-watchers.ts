import { multiplayerBoardShown } from '@libs/game-matchmaking-harness/multiplayer-board';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';

/** Read the rendered board and control eligibility of a watcher. */
export async function multiplayerWatcherBoard(
  s: ProductHarness,
  actor: string
) {
  const board = await multiplayerBoardShown(s, actor);
  const ui = await actorUi(s, actor);
  const announced = await ui.get('multiplayer-announcement').isVisible();
  const announcement = announced
    ? await ui.get('multiplayer-announcement').text()
    : null;
  return {
    ...board,
    standaloneOffered: await ui.get('tab-chess').isVisible(),
    announcement,
    canResign: await ui.get('multiplayer-resign').isVisible(),
    watching: (announcement ?? '').includes('Watching multiplayer chess.'),
  };
}
