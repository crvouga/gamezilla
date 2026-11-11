import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { endActiveSpace, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import { openMultiplayerFind } from './multiplayer-time-control-gesture';

const COMMAND_POLLS = 10;

/**
 * The command that ends the game, once its commands are on screen: Abort
 * before both have moved, Resign after. Reading before the commands have
 * painted would take a missing Abort for a game to resign.
 */
async function leavingCommand(ui: Driver): Promise<string> {
  for (let poll = 0; poll < COMMAND_POLLS; poll += 1) {
    if (await ui.get('multiplayer-resign').isVisible())
      return 'multiplayer-resign';
    try {
      await ui
        .get('multiplayer-abort')
        .expect.visible({ timeoutMs: JOURNEY_WAIT_MS / COMMAND_POLLS });
      return 'multiplayer-abort';
    } catch {
      // The commands are still opening, or the game offers Resign.
    }
  }
  return 'multiplayer-resign';
}

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
  // Aborting and resigning are among the game's commands, one press from
  // the board; whichever the game offers ends it.
  await tap(ui, 'multiplayer-open-commands');
  await tap(ui, await leavingCommand(ui));
  await tap(ui, 'multiplayer-confirm');
  await ui
    .get('multiplayer-confirm')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, 'multiplayer-dismiss');
  // The game is over: its result offers the search's hub, where Find is.
  await openMultiplayerFind(ui);
}

/** A failed scenario must not leave a search to consume the next person's match. */
export async function endMultiplayerSpace(ui: Driver): Promise<void> {
  await retirePreviousMultiplayer(ui);
  await endActiveSpace(ui);
}
