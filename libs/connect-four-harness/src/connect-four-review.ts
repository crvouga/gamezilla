import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
export const reviewConnectFour = scenarioAction({
  name: 'reviewConnectFour',
  act: async (s, actor: string, ply: number) => {
    const ui = await actorUi(s, actor);
    await ui.get('chess-custom-review-ply').clear();
    await ui.get('chess-custom-review-ply').input(String(ply));
    await ui.get('chess-custom-review-seek').tap();
  },
});
export const preferConnectFourReducedMotion = scenarioAction({
  name: 'preferConnectFourReducedMotion',
  act: async (s, actor: string) => {
    await s.actors.get(actor)!.device.setReducedMotion(true);
  },
});
export async function connectFourColumn(
  s: ProductHarness,
  actor: string,
  column: number
) {
  const ui = await actorUi(s, actor);
  const node = ui.get(`connect-four-column-${column + 1}`);
  return {
    full: await node.attribute('data-full'),
    disabled: await node.attribute('aria-disabled'),
    label: await node.attribute('aria-label'),
  };
}
export async function connectFourStatus(s: ProductHarness, actor: string) {
  return (await actorUi(s, actor)).get('chess-custom-status').text();
}
export const openConnectFourHistory = scenarioAction({
  name: 'openConnectFourHistory',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('custom-game-history-stats').tap();
    await ui.get('game-history-records').expect.visible();
  },
});
export async function connectFourHistoryStatistics(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  const stats = ui.get('game-history-statistics');
  return {
    wins: Number(await stats.attribute('data-wins')),
    losses: Number(await stats.attribute('data-losses')),
    draws: Number(await stats.attribute('data-draws')),
    record: await ui.get('game-history-record').text(),
  };
}

export async function connectFourBoardDescription(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  return ui.get('connect-four-board').text();
}
