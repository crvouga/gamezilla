import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  publicJourneyText,
  publicJourneyVisible,
} from './journey-failure-context';
import { expectVisible } from './journey-gestures';

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
