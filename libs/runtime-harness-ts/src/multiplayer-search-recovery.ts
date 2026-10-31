import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { endActiveSpace, JOURNEY_WAIT_MS, tap } from './journey-gestures';

/** A monitor account survives failed runs; retire its previous search or game. */
export async function retirePreviousMultiplayer(ui: Driver): Promise<void> {
  if (await ui.get('multiplayer-stop').isVisible()) {
    try {
      await tap(ui, 'multiplayer-stop');
    } catch (error) {
      // Matching can replace Stop between the visibility read and the tap.
      // Continue into game retirement only when that transition is observed.
      if (
        (await ui.get('multiplayer-stop').isVisible()) ||
        !(await ui.get('multiplayer-game').isVisible())
      )
        throw error;
    }
    await ui
      .get('multiplayer-stop')
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  }
  if (!(await ui.get('multiplayer-game').isVisible())) return;
  if (
    (await ui.get('multiplayer-game').attribute('data-outcome')) !== 'ongoing'
  )
    return;
  const action = (await ui.get('multiplayer-abort').isVisible())
    ? 'multiplayer-abort'
    : 'multiplayer-resign';
  await tap(ui, action);
  await tap(ui, 'multiplayer-confirm');
  await ui
    .get('multiplayer-confirm')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, 'multiplayer-dismiss');
  await ui
    .get('multiplayer-find')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/** A failed scenario must not leave a search to consume the next person's match. */
export async function endMultiplayerSpace(ui: Driver): Promise<void> {
  await retirePreviousMultiplayer(ui);
  await endActiveSpace(ui);
}
