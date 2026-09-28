import type { JourneyAccess } from '@libs/runtime/harness/critical-journeys';

export type CriticalJourneyAccessSetup = {
  readonly access: JourneyAccess;
  readonly launch: () => Promise<void>;
  readonly waitForTabShell: () => Promise<void>;
  readonly signIn: () => Promise<void>;
};

/** Establish the browser state a critical journey declares. */
export async function prepareCriticalJourneyAccess(
  setup: CriticalJourneyAccessSetup
): Promise<void> {
  await setup.launch();
  if (setup.access !== 'signed-in') return;
  await setup.waitForTabShell();
  await setup.signIn();
}
