import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, JOURNEY_WAIT_MS, tap } from './journey-gestures';

/**
 * The search's hub: where an idle screen opens, and one row from the
 * result of a game that is over.
 */
export async function openMultiplayerFind(ui: Driver): Promise<void> {
  if (
    !(await ui.get('multiplayer-find').isVisible()) &&
    (await ui.get('multiplayer-open-find').isVisible())
  )
    await tap(ui, 'multiplayer-open-find');
  await ui
    .get('multiplayer-find')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/**
 * Choose the clock on its own place, one row from the hub, which returns
 * to the hub with it. Keyboard activation avoids native pointer drift to a
 * neighboring choice.
 */
export async function chooseMultiplayerTimeControl(
  ui: Driver,
  timeControl: string
): Promise<void> {
  const id = `multiplayer-time-control-${timeControl.replace('+', '-')}`;
  await openMultiplayerFind(ui);
  await tap(ui, 'multiplayer-open-time-control');
  const option = ui.get(id);
  await option.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await option.key('enter');
  // Back on the hub, the clock's row names the one the search will find.
  const row = ui.get('multiplayer-open-time-control');
  await row.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  check(
    (await row.attribute('data-time-control')) === timeControl,
    `The requested multiplayer time control ${timeControl} was not selected`
  );
}
