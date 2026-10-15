import { enqueueMultiplayerAvailability } from '@libs/chess-matchmaking-shared/multiplayer-availability';
import { clockLeftMs } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import { multiplayerFixture } from './multiplayer-fixtures';
import { multiplayerView } from './multiplayer-reads';
import { runScheduledSweep } from './multiplayer-time';

export const SHARED_CLOCK_CONTROLS: Readonly<Record<string, string>> = {
  bullet: '1+0',
  blitz: '5+0',
  rapid: '10+0',
  classical: '30+0',
  daily: '1d',
};

/** The trusted host fences the accepted game, using the same transaction as moves. */
export const setMultiplayerAvailability = scenarioAction({
  name: 'setMultiplayerAvailability',
  act: async (s, actor: string, gameId: string, available: boolean) => {
    await multiplayerFixture(s, actor, async (tx, env) => {
      await enqueueMultiplayerAvailability(tx, {
        gameId,
        available,
        nowMs: env.now().getTime(),
        createId: env.createId,
      });
      return [];
    });
    await runScheduledSweep(s);
  },
});

export async function multiplayerPauseShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  return (await actorUi(s, actor)).get('multiplayer-paused').isVisible();
}

/** The exact agreed time behind both rendered clocks, in displayed whole seconds. */
export async function multiplayerClockSeconds(
  s: ProductHarness,
  actor: string
) {
  const game = (await multiplayerView(s, actor)).game;
  if (game === null) throw new Error('The multiplayer board is missing.');
  const now = s.harness.clock.now();
  return {
    white: Math.ceil(clockLeftMs(game, 'white', now) / 1000),
    black: Math.ceil(clockLeftMs(game, 'black', now) / 1000),
  };
}

export async function multiplayerCanLeave(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  return (
    (await ui.get(Handles.navBack).isVisible()) ||
    (await ui.get(Handles.spaceClose).isVisible())
  );
}
