import { multiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { actorUi } from '@libs/harness-ts/actor-ui';
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
/** The finding-an-opponent details actually rendered on this device. */
export async function opponentSearchPresentation(
  s: ProductHarness,
  actor: string
) {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const text = async (id: string) =>
    (await ui.get(id).isVisible()) ? ui.get(id).text() : null;
  const attribute = async (id: string, name: string) =>
    (await ui.get(id).isVisible()) ? ui.get(id).attribute(name) : null;
  const clockChoices = [];
  for (const clock of TIME_CONTROLS)
    if (
      await ui
        .get(`multiplayer-time-control-${timeControlKey(clock.id)}`)
        .isVisible()
    )
      clockChoices.push(clock.id);
  return {
    clockChoices,
    whiteClock: await text('multiplayer-white-clock'),
    blackClock: await text('multiplayer-black-clock'),
    clockDetail: await text('multiplayer-time-control'),
    firstMoveCountdown: await text('multiplayer-first-move-countdown'),
    waitingSeconds: await text('multiplayer-waiting-seconds'),
    opponent: await text('multiplayer-opponent'),
    side: await text('multiplayer-colour'),
    stopOffered:
      (await ui.get('multiplayer-stop').isVisible()) &&
      (await ui.get('multiplayer-stop').attribute('disabled')) === null &&
      (await ui.get('multiplayer-stop').attribute('aria-disabled')) !== 'true',
    seeking: await ui.get('multiplayer-waiting').isVisible(),
    gameId: (await ui.get('multiplayer-game').isVisible())
      ? await ui.get('multiplayer-game').attribute('data-game-id')
      : null,
    nearSide: await attribute('multiplayer-seat-near', 'data-side'),
    farSide: await attribute('multiplayer-seat-far', 'data-side'),
    nearPlayer: await attribute('multiplayer-seat-near', 'data-profile-id'),
    farPlayer: await attribute('multiplayer-seat-far', 'data-profile-id'),
    error: await text('multiplayer-error'),
  };
}
