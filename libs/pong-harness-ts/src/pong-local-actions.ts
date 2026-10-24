import { operateCustomGameControls } from '@libs/game-session-harness-ts/custom-game-controls';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  type PongLocalOpponent,
  type PongLocalStage,
  pongLocalView,
} from './pong-local-view';
import { PONG_BOARD } from './pong-view';

async function start(s: ProductHarness, actor = 'alice'): Promise<void> {
  await operateCustomGameControls(s, actor, { operation: 'start' });
}

export const startLocalPong = scenarioAction({
  name: 'startLocalPong',
  act: start,
});

/** Wait for a real victory while holding human paddles away; a bot uses its own inputs. */
async function finish(s: ProductHarness, actor = 'alice'): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const view = await pongLocalView(s, actor);
      if (view.localStage === 'finished') return true;
      const ui = await actorUi(s, actor);
      for (const paddle of view.controlledPaddles)
        await ui
          .get(`${PONG_BOARD}-${paddle === 'left' ? 'white' : 'black'}-control`)
          .input(paddle === 'left' ? '0' : '1000');
      return null;
    },
    { maxMs: 60_000, stepMs: 100, description: 'the local Pong victory' }
  );
}

export const finishLocalPong = scenarioAction({
  name: 'finishLocalPong',
  act: finish,
});

export const establishPongLocalStage = scenarioAction({
  name: 'establishPongLocalStage',
  act: async (
    s,
    setup: {
      readonly actor?: string;
      readonly opponent: PongLocalOpponent;
      readonly stage: PongLocalStage;
    }
  ) => {
    const actor = setup.actor ?? 'alice';
    await Promise.resolve(
      establishCustomGame.act(s, 'pong', {
        host: actor,
        first: actor,
        second: setup.opponent === 'bot' ? 'bot' : 'local',
        guests: true,
        ready: true,
        active: false,
        configuration: '1',
      })
    );
    if (setup.stage !== 'ready') await start(s, actor);
    if (setup.stage === 'finished') await finish(s, actor);
  },
});

export const PONG_LOCAL_ACTIONS = [
  establishPongLocalStage,
  startLocalPong,
  finishLocalPong,
];
