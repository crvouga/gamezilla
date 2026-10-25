import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { configureCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { pongGuidance } from './pong-guidance';
import { PONG_BOARD, type PongPaddle, pongView } from './pong-view';

/** Alice and the second local person share one device; no second account is invented. */
export const establishLocalPong = scenarioAction({
  name: 'establishLocalPong',
  act: (s, active: boolean = true, targetScore: number = 2) =>
    establishCustomGame.act(s, 'pong', {
      host: 'alice',
      first: 'alice',
      second: 'local',
      guests: true,
      active,
      ready: active,
      configuration: String(targetScore),
    }),
});

async function begin(s: ProductHarness, targetScore = 2): Promise<void> {
  await configureCustomGame(s, 'alice', {
    operation: 'rules',
    choice: String(targetScore),
  });
  await configureCustomGame(s, 'alice', { operation: 'ready' });
  await configureCustomGame(s, 'alice', { operation: 'start' });
}

export const beginLocalPong = scenarioAction({
  name: 'beginLocalPong',
  act: begin,
});

/** Prepare both paddles for the next serve through their ordinary controls. */
async function countdown(s: ProductHarness): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const stage = (await pongView(s)).stage;
      if (stage === 'playing') return true;
      if (stage === 'countdown') await positionPaddles(s, 500, 500);
      return null;
    },
    {
      maxMs: 5000,
      stepMs: 25,
      description: 'the Pong serve',
    }
  );
}

export const finishPongCountdown = scenarioAction({
  name: 'finishPongCountdown',
  act: countdown,
});

async function positionPaddles(
  s: ProductHarness,
  left: number,
  right: number
): Promise<void> {
  const ui = await actorUi(s, 'alice');
  await ui.get(`${PONG_BOARD}-white-control`).input(String(left));
  await ui.get(`${PONG_BOARD}-black-control`).input(String(right));
}

/** Play until the next actual point. The score oracle is the scenario/model, not this strategy. */
async function winPoint(s: ProductHarness, paddle: PongPaddle): Promise<void> {
  const initial = await pongView(s);
  const before = initial.score;
  let previous = initial.ball;
  await pollUntil(
    s,
    async () => {
      const next = await pongView(s);
      if (next.score.left !== before.left || next.score.right !== before.right)
        return true;
      const targets = pongGuidance(next, previous, paddle);
      await positionPaddles(s, targets.left, targets.right);
      previous = next.ball;
      return null;
    },
    { maxMs: 30_000, stepMs: 50, description: `a Pong point for ${paddle}` }
  );
}

export const winPongPoint = scenarioAction({
  name: 'winPongPoint',
  act: winPoint,
});

type PongScoreSetup = {
  readonly left: number;
  readonly right: number;
  readonly targetScore: number;
  readonly playing?: boolean;
};

/** Build a scoring precondition with ordinary controls, never an injected position or result. */
export const arrangePongScore = scenarioAction({
  name: 'arrangePongScore',
  act: async (s, setup: PongScoreSetup) => {
    await begin(s, setup.targetScore);
    for (const [side, points] of [
      ['left', setup.left],
      ['right', setup.right],
    ] as const) {
      for (let point = 0; point < points; point++) {
        await countdown(s);
        await winPoint(s, side);
      }
    }
    if (setup.playing === true) await countdown(s);
  },
});

export const PONG_ACTIONS = [
  establishLocalPong,
  beginLocalPong,
  finishPongCountdown,
  winPongPoint,
  arrangePongScore,
];
