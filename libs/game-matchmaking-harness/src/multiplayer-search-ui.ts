import { timeControlKey } from '@libs/game-matchmaking-shared/time-control';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';

/**
 * The clock choice a time control names, without its game's clock namespace
 * (`connect-four/5+0` → `5+0`): how finding an opponent offers it.
 */
export function clockChoiceOf(timeControl: string): string {
  return timeControl.split('/').at(-1) ?? timeControl;
}

const searches = new WeakMap<ProductHarness, Set<string>>();
export function scenarioSearchActors(s: ProductHarness): readonly string[] {
  return [...(searches.get(s) ?? [])];
}

/**
 * The existing shared Find controls, independent of game or transport: the
 * clock choice `timeControl` names (in any game's clock namespace), then Find.
 */
export const requestGameOpponent = scenarioAction({
  name: 'requestGameOpponent',
  act: async (s, actor: string, timeControl: string) => {
    const ui = await actorUi(s, actor);
    await ui
      .get(
        `multiplayer-time-control-${timeControlKey(clockChoiceOf(timeControl))}`
      )
      .tap();
    await ui.get('multiplayer-find').wait('enabled');
    const actors = searches.get(s) ?? new Set<string>();
    actors.add(actor);
    searches.set(s, actors);
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
