import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import {
  PONG_MATCH_BOARD,
  pongBoardId,
  pongControlledPaddles,
} from './pong-controls-view';
import type { PongPaddle } from './pong-view';

export type PongPlace = 'middle' | 'upper edge' | 'lower edge';

async function placeShown(
  s: ProductHarness,
  actor: string,
  paddle: PongPaddle,
  board: string
): Promise<string> {
  const ui = await actorUi(s, actor);
  const drawing = ui.get(`${board}-drawing`);
  const rect = ui.get(
    `${board}-${paddle === 'left' ? 'first' : 'second'}-paddle`
  );
  const courtHeight = Number(
    (await drawing.attribute('viewBox'))?.split(' ')[3]
  );
  const top = Number(await rect.attribute('y'));
  const height = Number(await rect.attribute('height'));
  if (top === 0) return 'upper edge';
  if (top + height === courtHeight) return 'lower edge';
  return top + height / 2 === courtHeight / 2 ? 'middle' : 'moving';
}

/** The court and ownership labels rendered on this person's device. */
export async function pongSharedView(s: ProductHarness, actor = 'alice') {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const board = await pongBoardId(s, actor);
  const gameShown = await ui.get(board).isVisible();
  const paddlePlace = new Map<string, string>();
  const owners = new Map<string, string>();
  if (gameShown) {
    for (const paddle of ['left', 'right'] as const)
      paddlePlace.set(paddle, await placeShown(s, actor, paddle, board));
    for (const position of board === PONG_MATCH_BOARD ? ['near', 'far'] : []) {
      const seat = ui.get(`multiplayer-seat-${position}`);
      const side = await seat.attribute('data-side');
      owners.set(
        side === 'white' ? 'left' : 'right',
        (await seat.text()) ?? ''
      );
    }
  }
  return {
    gameShown,
    paddlePlace,
    owners,
    controlledPaddles: await pongControlledPaddles(s, actor, board),
  };
}

/** Model observations read every court without acting on play or connectivity. */
export async function pongSharedCourts(s: ProductHarness) {
  const paddlePlace = new Map<string, Map<string, string>>();
  const controlledPaddles = new Map<string, Set<string>>();
  const gameShown = new Map<string, boolean>();
  for (const person of ['alice', 'bob', 'carol']) {
    const view = await pongSharedView(s, person);
    paddlePlace.set(person, view.paddlePlace);
    controlledPaddles.set(person, new Set(view.controlledPaddles));
    gameShown.set(person, view.gameShown);
  }
  return { paddlePlace, controlledPaddles, gameShown };
}
