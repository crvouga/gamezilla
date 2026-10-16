import type { JourneyAccess } from '@libs/runtime-harness/journey-types';

export type CriticalJourneyAccessSetup = {
  readonly access: JourneyAccess;
  readonly launch: () => Promise<void>;
  readonly waitForTabShell: () => Promise<void>;
  readonly waitForOfflineShell: () => Promise<void>;
  readonly signIn: () => Promise<void>;
};

/**
 * Establish the browser state a critical journey declares.
 * `launch()` only waits for document navigation, so every journey waits for
 * the tab route and offline installation before the first gesture. Signed-in
 * journeys then sign in. A closed page must not leave an unfinished install
 * competing with the next fresh device's requests.
 */
export async function prepareCriticalJourneyAccess(
  setup: CriticalJourneyAccessSetup
): Promise<void> {
  await setup.launch();
  await setup.waitForTabShell();
  await setup.waitForOfflineShell();
  if (setup.access !== 'signed-in') return;
  await setup.signIn();
}
