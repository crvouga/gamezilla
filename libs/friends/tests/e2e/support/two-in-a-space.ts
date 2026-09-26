import type { OpenSim } from '@libs/sim-harness/open-sim/open-sim';
import {
  closeSpaceMembers,
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  openSpaceMembers,
} from '@libs/spaces/sim/space-actions';
import {
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces/sim/spaces-ui-reads';

const PRESENCE_WAIT_MS = 20_000;

/** Alice hosts a space; bob joins it from her link. Both are guests. */
export async function twoInASpace(s: OpenSim): Promise<string> {
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('alice is not in a space');
  await s.apply(openSpaceLink, 'bob', link);
  await s.apply(joinFromPrompt, 'bob');
  return link;
}

/**
 * Open `actorId`'s members sheet and wait until it counts exactly `count`
 * people, then close it. The count is what the person would read: nobody
 * twice, nobody who has gone.
 */
export async function expectPresence(
  s: OpenSim,
  actorId: string,
  count: number
): Promise<void> {
  await s.apply(openSpaceMembers, actorId);
  await s.until((surf) => readSpacePresenceCount(surf, actorId), {
    pred: (n) => n === count,
    maxMs: PRESENCE_WAIT_MS,
  });
  await s.apply(closeSpaceMembers, actorId);
}
