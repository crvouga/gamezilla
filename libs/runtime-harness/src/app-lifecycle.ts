/**
 * The app as something a person installs, opens and updates: opening an
 * address directly, a device left on a build the product no longer accepts,
 * and updating it.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { HARNESS_PRIMARY_SERVER_ID } from '@libs/harness/server-nodes';
import type { ProductHarness } from '@libs/harness/harness';
import { visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

const WAIT_MS = 15_000;

/** Open `path` directly, the way a person pastes or follows a link. */
export const openAddress = scenarioAction({
  name: 'openAddress',
  act: async (s, actorId: string, path: string) => {
    await actorUi(s, actorId);
    const actor = s.actors.get(actorId);
    if (actor === undefined) throw new Error(`${actorId} has no app open`);
    await actor.openLink(path);
    await s.session.waitForIdle();
  },
});

/** Take the not-found screen's way back to Spaces. */
export const followNotFoundWayBack = scenarioAction({
  name: 'followNotFoundWayBack',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.routeNotFoundAction).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** The app says there is nothing at the address it was opened on. */
export async function notFoundShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.routeNotFound]);
}

/** The not-found screen offers the way back to Spaces. */
export async function notFoundWayBackOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.routeNotFoundAction]);
}

/**
 * The product moved on while the device was away: its app is now a build
 * older than the product accepts. It learns so the next time it reaches the
 * product.
 */
export const leaveAppOutdated = scenarioAction({
  name: 'leaveAppOutdated',
  act: async (s, actorId: string) => {
    await actorUi(s, actorId);
    s.harness.setAppBuild(actorId, 'outdated');
  },
});

/**
 * Install the current build and open it: the update comes over the network,
 * so the device is connected afterwards. Its storage is untouched.
 */
export const updateApp = scenarioAction({
  name: 'updateApp',
  act: async (s, actorId: string) => {
    s.harness.setAppBuild(actorId, 'current');
    s.session.network.heal(HARNESS_PRIMARY_SERVER_ID, actorId);
    await s.runtime.restartActor(actorId);
    await actorUi(s, actorId);
  },
});

/** The app asks the person to update it. */
export async function updateRequested(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.appUpdateRequired]);
}
