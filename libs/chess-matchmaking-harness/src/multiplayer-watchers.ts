import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { multiplayerSpaceId } from './multiplayer-spaces';

export const joinMultiplayerSpace = scenarioAction({
  name: 'joinMultiplayerSpace',
  act: async (s, watcher: string, host: string) => {
    await ensureActor(s, watcher);
    const spaceId = await multiplayerSpaceId(s, host);
    if (spaceId === null) throw new Error('The multiplayer host has no space');
    await Promise.resolve(joinViaLink.act(s, watcher, `/space/${spaceId}`));
    const hostBoard = await multiplayerWatcherBoard(s, host);
    await pollUntil(
      s,
      async () =>
        (await multiplayerWatcherBoard(s, watcher)).gameId === hostBoard.gameId
          ? true
          : null,
      { maxMs: 5000, description: 'the shared multiplayer board' }
    );
  },
});

/** Read the rendered board and control eligibility of a watcher. */
export async function multiplayerWatcherBoard(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
  const html = await ui.snapshotHtml();
  const tag = html?.match(/<[^>]*data-testid="multiplayer-game"[^>]*>/)?.[0];
  return {
    gameId: tag?.match(/data-game-id="([^"]+)"/)?.[1] ?? null,
    fen: tag?.match(/data-fen="([^"]+)"/)?.[1] ?? null,
    canResign: await ui.get('multiplayer-resign').isVisible(),
    watching:
      (await ui.get('multiplayer-announcement').isVisible()) &&
      ((await ui.get('multiplayer-announcement').text()) ?? '').includes(
        'Watching multiplayer chess.'
      ),
  };
}
