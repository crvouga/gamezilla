import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { pongLocalView } from './pong-local-view';
import { pongSharedView } from './pong-shared-view';

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
    const court = await pongSharedView(s, person);
    gameShown.set(person, court.gameShown);
    controlledPaddles.set(person, new Set(court.controlledPaddles));
    paddlePlace.set(
      person,
      local.localStage === 'playing'
        ? (court.paddlePlace.get('left') ?? 'not shown')
        : 'not playing'
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
