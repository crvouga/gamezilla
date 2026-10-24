import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { PONG_BOARD, type PongPaddle } from './pong-view';

export const PONG_MATCH_BOARD = 'multiplayer-board';

/** Enabled controls are the paddles this device can actually guide. */
export async function pongControlledPaddles(
  s: ProductHarness,
  actor = 'alice',
  boardId?: string
): Promise<PongPaddle[]> {
  const ui = await actorUi(s, actor);
  const board =
    boardId ??
    ((await ui.get(PONG_MATCH_BOARD).isVisible())
      ? PONG_MATCH_BOARD
      : PONG_BOARD);
  const paddles: PongPaddle[] = [];
  for (const [seat, paddle] of [
    ['white', 'left'],
    ['black', 'right'],
  ] as const) {
    const control = ui.get(`${board}-${seat}-control`);
    if (
      (await control.isVisible()) &&
      (await control.attribute('disabled')) === null &&
      (await control.attribute('aria-disabled')) !== 'true'
    )
      paddles.push(paddle);
  }
  return paddles;
}
