import { timeControlKey } from '@libs/game-matchmaking-shared/time-control';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';

/** The existing shared Find controls, independent of game or transport. */
export const requestGameOpponent = scenarioAction({
  name: 'requestGameOpponent',
  act: async (s, actor: string, timeControl: string) => {
    const ui = await actorUi(s, actor);
    await ui
      .get(`multiplayer-time-control-${timeControlKey(timeControl)}`)
      .tap();
    await ui.get('multiplayer-find').wait('enabled');
    await ui.get('multiplayer-find').tap();
    await pollUntil(
      s,
      async () => {
        return (await ui.get('multiplayer-waiting').isVisible()) ||
          (await ui.get('multiplayer-game').isVisible())
          ? true
          : null;
      },
      { maxMs: 15000, description: 'opponent search accepted or assigned' }
    );
  },
});
