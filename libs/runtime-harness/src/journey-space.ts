import { endActiveSpace, hostSpace } from './journey-gestures';
import type { JourneyWorld } from './journey-types';

/** Cleanup key of a hosted space the scenario has not ended yet. */
const HOSTED_SPACE = 'hosted-space';

/**
 * Host a space and end it when the scenario closes, unless it ended it.
 * The cleanup is registered first so a failure after the space exists still
 * ends it, instead of leaving the monitor account at its hosting limit.
 */
export async function hostDeferringEnd(w: JourneyWorld): Promise<void> {
  w.journey.defer(HOSTED_SPACE, endActiveSpace);
  await w.journey.act('hostSpace', hostSpace);
}

export async function endHostedSpace(w: JourneyWorld): Promise<void> {
  await w.journey.act('endActiveSpace', endActiveSpace);
  w.journey.settle(HOSTED_SPACE);
}
