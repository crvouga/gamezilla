import { operateCustomGameControls } from '@libs/game-session-harness-ts/custom-game-controls';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { DriverNode } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  type PongLocalOpponent,
  type PongLocalStage,
  pongLocalView,
} from './pong-local-view';
import { PONG_BOARD } from './pong-view';

async function start(s: ProductHarness, actor = 'alice'): Promise<void> {
  await operateCustomGameControls(s, actor, { operation: 'start' });
  await pollUntil(
    s,
    async () =>
      (await pongLocalView(s, actor)).controlledPaddles.length > 0
        ? true
        : null,
    { maxMs: 5000, stepMs: 25, description: 'local Pong controls ready' }
  );
}

export const startLocalPong = scenarioAction({
  name: 'startLocalPong',
  act: start,
});

/**
 * Hold one paddle at `value`. The point that ends the game can land between
 * reading the court and holding the paddle: the finished board takes its
 * paddle controls away, so a hold that finds none because the game is over
 * is the victory, not a failure. Any other failed hold is one.
 */
export async function holdPaddleUnlessFinished(
  control: DriverNode,
  value: string,
  finished: () => Promise<boolean>
): Promise<'held' | 'finished'> {
  try {
    await control.input(value);
    return 'held';
  } catch (error) {
    // regression: pong-local-finish-control-race
    if (await finished()) return 'finished';
    throw error;
  }
}

/** Wait for a real victory while holding human paddles away; a bot uses its own inputs. */
async function finish(s: ProductHarness, actor = 'alice'): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const view = await pongLocalView(s, actor);
      if (view.localStage === 'finished') return true;
      const ui = await actorUi(s, actor);
      for (const paddle of view.controlledPaddles) {
        const control = ui.get(
          `${PONG_BOARD}-${paddle === 'left' ? 'white' : 'black'}-control`
        );
        const held = await holdPaddleUnlessFinished(
          control,
          paddle === 'left' ? '0' : '1000',
          async () => (await pongLocalView(s, actor)).localStage === 'finished'
        );
        if (held === 'finished') return true;
      }
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
        configuration: '3',
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
