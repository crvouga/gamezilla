import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { multiplayerEndingView } from './multiplayer-ending-view';

/** Let the registered game's own countdown finish, observing its rendered play. */
export const waitForMatchedPlay = scenarioAction({
  name: 'waitForMatchedPlay',
  act: async (s, actor: string, gameId: string) => {
    const simulation = s.harness.composition.app.turnGames.simulation(gameId);
    if (simulation === undefined)
      throw new Error(`${gameId} has no simulation`);
    await pollUntil(
      s,
      async () => {
        const view = await multiplayerEndingView(s, actor);
        if (view.position === null) return null;
        const state = simulation.codec.decode(view.position);
        return state !== null &&
          (simulation.phase?.(state) ?? 'running') === 'running'
          ? true
          : null;
      },
      {
        maxMs: 30_000,
        stepMs: 25,
        description: `${gameId}'s play beginning`,
      }
    );
  },
});
