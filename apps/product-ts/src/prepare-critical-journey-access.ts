import type { JourneyAccess } from '@libs/runtime-harness-ts/journey-types';

export type CriticalJourneyAccessSetup = {
  readonly access: JourneyAccess;
  readonly launch: () => Promise<void>;
  readonly waitForTabShell: () => Promise<void>;
  readonly signIn: () => Promise<void>;
};

/**
 * Establish the browser state a critical journey declares.
 * `launch()` only waits for document navigation, so every journey waits for
 * the tab shell before the first gesture. Signed-in journeys then sign in.
 */
export async function prepareCriticalJourneyAccess(
  setup: CriticalJourneyAccessSetup
): Promise<void> {
  await setup.launch();
  await setup.waitForTabShell();
  if (setup.access !== 'signed-in') return;
  await setup.signIn();
}
