import { pairGamePlayers } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { pongBoardId } from './pong-controls-view';
import { type PongPlace, pongSharedView } from './pong-shared-view';
import type { PongPaddle } from './pong-view';

/** Production mutation fixtures pair real accounts, with the first person on Left. */
export const establishSharedPong = scenarioAction({
  name: 'establishSharedPong',
  act: async (s) => {
    await Promise.resolve(pairGamePlayers.act(s, 'pong', 'alice', 'bob'));
    await s.session.advanceTime(4000);
  },
});

export const joinSharedPong = scenarioAction({
  name: 'joinSharedPong',
  act: async (s, actor: string = 'carol', host: string = 'alice') => {
    const link = await readSpaceLink(s, host);
    if (link === null) throw new Error(`${host} has no space link`);
    await Promise.resolve(joinViaLink.act(s, actor, link));
  },
});

/** Use the offered paddle control. An unoffered paddle has no gesture to send. */
export const guideSharedPong = scenarioAction({
  name: 'guideSharedPong',
  act: async (s, actor: string, paddle: PongPaddle, place: PongPlace) => {
    const board = await pongBoardId(s, actor);
    const control = (await actorUi(s, actor)).get(
      `${board}-${paddle === 'left' ? 'white' : 'black'}-control`
    );
    if (
      (await control.isVisible()) &&
      (await control.attribute('disabled')) === null
    ) {
      const targets = {
        middle: '500',
        'upper edge': '0',
        'lower edge': '1000',
      };
      await control.input(targets[place]);
      await s.session.advanceTime(1000);
    }
  },
});

/** Build a visible court location using the same human control, not an injected position. */
export const arrangeSharedPong = scenarioAction({
  name: 'arrangeSharedPong',
  act: async (s, actor: string, place: PongPlace) => {
    const paddle = actor === 'alice' ? 'left' : 'right';
    await Promise.resolve(guideSharedPong.act(s, actor, paddle, place));
    await pollUntil(
      s,
      async () =>
        (await pongSharedView(s, actor)).paddlePlace.get(paddle) === place
          ? true
          : null,
      {
        maxMs: 5000,
        stepMs: 25,
        description: `${actor}'s paddle at the ${place}`,
      }
    );
  },
});

export const PONG_SHARED_ACTIONS = [
  establishSharedPong,
  joinSharedPong,
  guideSharedPong,
  arrangeSharedPong,
];
