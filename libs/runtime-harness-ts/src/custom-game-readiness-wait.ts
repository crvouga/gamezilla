import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  publicJourneyText,
  publicJourneyVisible,
} from './journey-failure-context';
import { expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';

/** A failed acceptance names the awaited control and the screen already shown. */
export async function expectBlackAccepted(ui: Driver): Promise<void> {
  try {
    await expectVisible(ui, 'custom-game-black-release');
  } catch (cause) {
    const participant = await publicJourneyVisible(
      ui,
      'custom-game-black-release'
    );
    const invited = await publicJourneyVisible(
      ui,
      'custom-game-black-invitation'
    );
    const context = {
      choiceFailure: await publicJourneyText(ui, 'custom-game-error'),
      role:
        participant === true
          ? 'black participant'
          : invited === true
            ? 'invited to black'
            : 'unknown',
      connectionNeeded: await publicJourneyVisible(
        ui,
        'custom-game-connection-needed'
      ),
      status: await publicJourneyText(ui, 'custom-game-status'),
    };
    throw new Error(
      `${String(cause)}; custom-game-black-release expect.visible; ${JSON.stringify(context)}`,
      { cause }
    );
  }
}

const TAKE_ATTEMPTS = 3;
const TAKE_SETTLE_MS = 5_000;

async function chooseWhenConnected(ui: Driver, control: string): Promise<void> {
  await ui.get(control).expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get('custom-game-connection-needed')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, control);
}

/**
 * Take Black with `control` (claiming or accepting it). A device that has
 * just joined the space is still connecting to it, and a choice made before
 * it connects is refused: wait for the connection, and choose again when a
 * choice did not take.
 */
export async function takeBlack(ui: Driver, control: string): Promise<void> {
  const release = ui.get('custom-game-black-release');
  for (let attempt = 1; attempt < TAKE_ATTEMPTS; attempt += 1) {
    if (await release.isVisible()) return;
    await chooseWhenConnected(ui, control);
    try {
      await release.expect.visible({ timeoutMs: TAKE_SETTLE_MS });
      return;
    } catch {
      // The choice did not take; the next attempt chooses again.
    }
  }
  if (!(await release.isVisible())) await chooseWhenConnected(ui, control);
  await expectBlackAccepted(ui);
}
