import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { pongLocalView } from './pong-local-view';
import { pongPaddlePlace } from './pong-shared-view';
import { PONG_BOARD } from './pong-view';

export const prepareLocalPongViewer = scenarioAction({
  name: 'prepareLocalPongViewer',
  act: async (s) => {
    await ensureActor(s, 'carol');
  },
});

/** Observe Alice's human paddle; a bot's independently guided paddle is outside this model. */
export async function pongLocalCourts(s: ProductHarness) {
  const alice = await pongLocalView(s, 'alice');
  const gameShown = new Map<string, boolean>();
  const controlledPaddles = new Map<string, Set<string>>();
  const paddlePlace = new Map<string, string>();
  for (const person of ['alice', 'carol']) {
    const local = person === 'alice' ? alice : await pongLocalView(s, person);
    const playing = local.localStage === 'playing';
    gameShown.set(person, local.gameShown);
    controlledPaddles.set(person, new Set(local.controlledPaddles));
    paddlePlace.set(
      person,
      !playing
        ? 'not playing'
        : (await (await actorUi(s, person)).get(PONG_BOARD).isVisible())
          ? await pongPaddlePlace(s, person, 'left', PONG_BOARD)
          : 'not shown'
    );
  }
  return {
    localStage: alice.localStage,
    localOpponent: alice.localOpponent,
    gameShown,
    controlledPaddles,
    paddlePlace,
  };
}
