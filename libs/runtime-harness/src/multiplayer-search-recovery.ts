import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { JOURNEY_WAIT_MS, tap } from './journey-gestures';

/** A monitor account survives failed runs; retire its previous search or game. */
export async function retirePreviousMultiplayer(ui: Driver): Promise<void> {
  if (await ui.get('multiplayer-stop').isVisible()) {
    await tap(ui, 'multiplayer-stop');
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
