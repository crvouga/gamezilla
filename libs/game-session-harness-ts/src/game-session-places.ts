/**
 * The game session's small places, as a person moves between them: a control
 * that sits on another place is reached by pressing the row that opens it,
 * and Back returns to the place the game's phase opens on.
 */
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** The places a phase opens on: Back from one leaves the game session. */
const HOME_PLACES: ReadonlySet<string> = new Set([
  'home',
  'setup',
  'stage',
  'result',
]);

/** Behind any place there are at most two more (inviting, then its seat). */
const DEEPEST_PLACE = 3;

/** The place `actor`'s device shows, or `null` when no game session shows. */
export async function gameSessionPlace(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const content = (await actorUi(s, actor)).get('game-session-content');
  return (await content.isVisible())
    ? await content.attribute('data-place')
    : null;
}

/** `actor` goes back, a step at a time, to the place their game's phase opens on. */
export async function showGameSessionHome(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  for (let step = 0; step < DEEPEST_PLACE; step += 1) {
    const place = await gameSessionPlace(s, actor);
    if (place === null || HOME_PLACES.has(place)) return;
    // The commands sheet covers the shell's Back button.
    const back = place === 'commands' ? 'game-session-resume' : Handles.navBack;
    await ui.get(back).tap();
    await s.session.waitForIdle();
  }
}

/**
 * `actor` opens the place holding `control` by pressing `row` on the home
 * place, unless the control already shows. Whether the control shows after.
 */
export async function openGameSessionPlace(
  s: ProductHarness,
  actor: string,
  row: string,
  control: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  if (await ui.get(control).isVisible()) return true;
  await showGameSessionHome(s, actor);
  if (await ui.get(control).isVisible()) return true;
  if (!(await ui.get(row).isVisible())) return false;
  await ui.get(row).tap();
  await s.session.waitForIdle();
  return ui.get(control).isVisible();
}
