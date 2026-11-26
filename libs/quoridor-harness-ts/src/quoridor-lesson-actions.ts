import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';

export const movePracticePawn = scenarioAction({
  name: 'movePracticePawn',
  act: async (s, actor: string, cell: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(`practice-board-action-${cell}`).key('enter');
  },
});

export async function practiceOpening(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  return {
    pawn: await ui.get('practice-board-action-e1').attribute('aria-label'),
    forward: await ui
      .get('practice-board-action-e2')
      .attribute('aria-disabled'),
    next: await ui.get('practice-next').isVisible(),
  };
}

export async function practiceMoveFinished(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  return (
    (await ui.get('practice-next').isVisible()) &&
    (
      await ui.get('practice-board-action-e2').attribute('aria-label')
    )?.includes('South red circle')
  );
}
