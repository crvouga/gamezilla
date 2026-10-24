import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';

export type PongPaddle = 'left' | 'right';
export type PongStage =
  | 'countdown'
  | 'playing'
  | 'finished'
  | 'paused'
  | 'reconnecting';
export const PONG_BOARD = 'custom-game-board';

function trailingNumber(text: string | null): number {
  const value = text?.match(/\d+$/)?.[0];
  if (value === undefined) throw new Error(`No displayed number in ${text}`);
  return Number(value);
}

/** Scores, status and ball geometry are read from the same board a person sees. */
export async function pongView(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  const status = await ui.get(`${PONG_BOARD}-status`).text();
  if (status === null) throw new Error('No Pong status is shown');
  const winner: PongPaddle | null =
    status === 'Left wins.'
      ? 'left'
      : status === 'Right wins.'
        ? 'right'
        : null;
  const stage: PongStage =
    winner !== null
      ? 'finished'
      : status.startsWith('Serve in ')
        ? 'countdown'
        : status === 'Keep the ball in play.'
          ? 'playing'
          : status.startsWith('Paused ')
            ? 'paused'
            : 'reconnecting';
  const ball = ui.get(`${PONG_BOARD}-ball`);
  const bounds = (await ui.get(`${PONG_BOARD}-drawing`).attribute('viewBox'))
    ?.split(' ')
    .map(Number);
  if (bounds?.length !== 4 || !bounds.every(Number.isFinite))
    throw new Error('No visible Pong court bounds');
  return {
    score: {
      left: trailingNumber(await ui.get(`${PONG_BOARD}-score-left`).text()),
      right: trailingNumber(await ui.get(`${PONG_BOARD}-score-right`).text()),
    },
    targetScore: trailingNumber(await ui.get(`${PONG_BOARD}-target`).text()),
    stage,
    winner,
    ball: {
      x:
        Number(await ball.attribute('x')) +
        Number(await ball.attribute('width')) / 2,
      y:
        Number(await ball.attribute('y')) +
        Number(await ball.attribute('height')) / 2,
    },
    height: bounds[3]!,
  };
}

/** The people named in this one-device lineup are Alice on Left and Bob on Right. */
export async function pongPoints(
  s: ProductHarness,
  person: string
): Promise<number> {
  return (await pongView(s)).score[person === 'alice' ? 'left' : 'right'];
}

export async function pongVictor(s: ProductHarness): Promise<string | null> {
  const winner = (await pongView(s)).winner;
  return winner === null ? null : winner === 'left' ? 'alice' : 'bob';
}

export async function pongStageShown(s: ProductHarness): Promise<string> {
  const stage = (await pongView(s)).stage;
  return stage === 'countdown'
    ? 'counting down'
    : stage === 'playing'
      ? 'in play'
      : stage;
}
