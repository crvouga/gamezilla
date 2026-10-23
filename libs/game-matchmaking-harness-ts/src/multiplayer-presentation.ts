import { multiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

/** The visible match details, independent of their arrangement in the lineup. */
export async function shownMultiplayerLineup(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  return {
    opponent: await multiplayerText(s, actor, 'multiplayer-opponent'),
    timeControl: await multiplayerText(s, actor, 'multiplayer-time-control'),
    colour: await multiplayerText(s, actor, 'multiplayer-colour'),
  };
}

/** The search message and its separate, quietly updating elapsed counter. */
export async function shownMultiplayerSearch(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  const elapsed = await multiplayerText(
    s,
    actor,
    'multiplayer-waiting-seconds'
  );
  return {
    message: await multiplayerText(s, actor, 'multiplayer-waiting'),
    elapsedSeconds:
      elapsed !== null && /^\d+$/.test(elapsed) ? Number(elapsed) : null,
  };
}
