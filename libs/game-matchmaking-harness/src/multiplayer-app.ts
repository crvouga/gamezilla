import { ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import { bringToFront } from '@libs/harness/observations';

/**
 * The person closes the app on this device. Its storage stays; nothing on it
 * runs until they reopen it, and the game goes on without them.
 */
export const closeMultiplayerApp = scenarioAction({
  name: 'closeMultiplayerApp',
  act: async (s, actor: string) => {
    await s.runtime.restartActor(actor);
    const remaining = s.actors.keys().next().value;
    if (remaining !== undefined) await bringToFront(s, remaining);
  },
});

/** The person opens the app again on the device they closed it on. */
export const reopenMultiplayerApp = scenarioAction({
  name: 'reopenMultiplayerApp',
  act: async (s, actor: string) => {
    await ensureActor(s, actor);
    await s.session.waitForIdle();
  },
});
