import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { PONG_BOARD, type PongPaddle } from './pong-view';

export const PONG_MATCH_BOARD = 'multiplayer-board';

export async function pongBoardId(s: ProductHarness, actor: string) {
  return (await (await actorUi(s, actor)).get(PONG_MATCH_BOARD).isVisible())
    ? PONG_MATCH_BOARD
    : PONG_BOARD;
}

/** A visible empty move pane still offers its controls; absence of the court is not a pass. */
export async function pongMoveListOffered(
  s: ProductHarness,
  actor = 'alice'
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  if (!(await ui.get(await pongBoardId(s, actor)).isVisible()))
    throw new Error('No Pong court is shown');
  for (const id of [
    'custom-game-review-back',
    'custom-game-review-forward',
    'custom-game-review-ply',
    'multiplayer-moves',
  ])
    if (await ui.get(id).isVisible()) return true;
  return false;
}

/** Enabled controls are the paddles this device can actually guide. */
export async function pongControlledPaddles(
  s: ProductHarness,
  actor = 'alice',
  boardId?: string
): Promise<PongPaddle[]> {
  const ui = await actorUi(s, actor);
  const board = boardId ?? (await pongBoardId(s, actor));
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
