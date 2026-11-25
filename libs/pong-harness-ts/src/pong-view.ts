import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

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
  return readPongCourt(await actorUi(s, actor), PONG_BOARD);
}

/** Read the scoreboard without sampling ball and paddle positions during live play. */
export async function readPongScoreboard(ui: Driver, board: string) {
  // The court's status carries what it says as data, so readers never
  // depend on its words; during live play only the spoken summary shows.
  const status = ui.get(`${board}-status`);
  // regression: pong-court-read-before-reopened-board
  // A reopened app draws the court a moment after it starts in a real
  // browser; read it once it is shown, as a person looking at it would.
  await status.expect.visible();
  if ((await status.text()) === null)
    throw new Error('No Pong status is shown');
  const stage = ((await status.attribute('data-stage')) ??
    'playing') as PongStage;
  const shown = await status.attribute('data-winner');
  const winner: PongPaddle | null =
    shown === 'left' || shown === 'right' ? shown : null;
  return {
    score: {
      left: trailingNumber(await ui.get(`${board}-score-left`).text()),
      right: trailingNumber(await ui.get(`${board}-score-right`).text()),
    },
    targetScore: trailingNumber(await ui.get(`${board}-target`).text()),
    stage,
    winner,
  };
}

export async function pongScoreboard(s: ProductHarness, actor = 'alice') {
  return readPongScoreboard(await actorUi(s, actor), PONG_BOARD);
}

export async function readPongCourt(ui: Driver, board: string) {
  const scoreboard = await readPongScoreboard(ui, board);
  // The ball as the game plays it (court units), not as it is drawn.
  const ball = ui.get(`${board}-ball`);
  const radius = Number(await ball.attribute('data-ball-size')) / 2;
  const bounds = (await ui.get(`${board}-drawing`).attribute('viewBox'))
    ?.split(' ')
    .map(Number);
  if (bounds?.length !== 4 || !bounds.every(Number.isFinite))
    throw new Error('No visible Pong court bounds');
  return {
    ...scoreboard,
    ball: {
      x: Number(await ball.attribute('data-ball-x')),
      y: Number(await ball.attribute('data-ball-y')),
    },
    height: bounds[3]!,
    radius,
    faces: {
      left: await paddleFace(ui, board, 'first', radius),
      right: await paddleFace(ui, board, 'second', radius),
    },
  };
}

async function paddleFace(
  ui: Driver,
  board: string,
  side: 'first' | 'second',
  radius: number
): Promise<number> {
  const paddle = ui.get(`${board}-${side}-paddle`);
  const x = Number(await paddle.attribute('x'));
  return side === 'first'
    ? x + Number(await paddle.attribute('width')) + radius
    : x - radius;
}

/** The people named in this one-device lineup are Alice on Left and Bob on Right. */
export async function pongPoints(
  s: ProductHarness,
  person: string
): Promise<number> {
  return (await pongScoreboard(s)).score[person === 'alice' ? 'left' : 'right'];
}

export async function pongVictor(s: ProductHarness): Promise<string | null> {
  const winner = (await pongScoreboard(s)).winner;
  return winner === null ? null : winner === 'left' ? 'alice' : 'bob';
}

export async function pongStageShown(s: ProductHarness): Promise<string> {
  const stage = (await pongScoreboard(s)).stage;
  return stage === 'countdown'
    ? 'counting down'
    : stage === 'playing'
      ? 'in play'
      : stage;
}
