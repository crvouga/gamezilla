import type { JourneyAccess } from '@libs/runtime-harness-ts/journey-types';

export type CriticalJourneyAccessSetup = {
  readonly access: JourneyAccess;
  readonly launch: () => Promise<void>;
  readonly waitForTabShell: () => Promise<void>;
  readonly signIn: () => Promise<void>;
  /** Prove to the server that monitoring drives this anonymous device. */
  readonly markSynthetic: () => Promise<void>;
};

/**
 * Establish the browser state a critical journey declares.
 * `launch()` only waits for document navigation, so every journey waits for
 * the tab shell before the first gesture. Signed-in journeys then sign in
 * (a monitor session is synthetic already); anonymous journeys mark their
 * account synthetic, so what they publish is withdrawn even if their cleanup
 * never runs.
 */
export async function prepareCriticalJourneyAccess(
  setup: CriticalJourneyAccessSetup
): Promise<void> {
  await setup.launch();
  await setup.waitForTabShell();
  if (setup.access === 'signed-in') await setup.signIn();
  // regression: synthetic-journey-packs-outlive-their-run
  else await setup.markSynthetic();
}
