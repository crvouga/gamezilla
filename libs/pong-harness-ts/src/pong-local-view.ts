import { customGameStartOffered } from '@libs/game-session-harness-ts/custom-game-reads';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { pongControlledPaddles } from './pong-controls-view';
import { PONG_BOARD } from './pong-view';

export type PongLocalStage = 'ready' | 'playing' | 'finished';
export type PongLocalOpponent = 'person' | 'bot';

/** The local game's lifecycle is separate from the ball's countdown and motion. */
export async function pongLocalView(s: ProductHarness, actor = 'alice') {
  const screen = await readCustomGameScreen(s, actor);
  const current = screen?.current;
  const stage =
    current?.status === 'active'
      ? 'playing'
      : current?.status === 'completed'
        ? 'finished'
        : current?.status === 'configuring' &&
            (await customGameStartOffered(s, actor))
          ? 'ready'
          : (current?.status ?? 'none');
  return {
    localStage: stage,
    localOpponent:
      current?.black.kind === 'local'
        ? 'person'
        : current?.black.kind === 'person'
          ? 'remote'
          : (current?.black.kind ?? ''),
    gameShown: await (await actorUi(s, actor)).get(PONG_BOARD).isVisible(),
    controlledPaddles: await pongControlledPaddles(s, actor, PONG_BOARD),
  };
}
