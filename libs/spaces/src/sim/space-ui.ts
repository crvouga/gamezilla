import { actorUi, pollUntil } from '@libs/sim-harness/system/actor-ui';
import { backToTabs } from '@libs/sim-harness/system/shell-actions';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

export const SPACE_WAIT_MS = 10_000;
export const SPACE_HIDDEN_MS = 5_000;

export async function showSpacesTab(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: SPACE_WAIT_MS,
  });
  // Out of an open space (still in it) or a stacked screen, as a person
  // would, before reaching for the tab.
  if (await ui.get(Handles.spaceClose).isVisible()) {
    await ui.get(Handles.spaceClose).tap({ timeoutMs: SPACE_WAIT_MS });
    await s.session.waitForIdle();
  }
  if (!(await ui.get(Handles.tabSpaces).isVisible())) {
    await Promise.resolve(backToTabs.act(s, actorId));
  }
  await ui.get(Handles.tabSpaces).tap({ timeoutMs: SPACE_WAIT_MS });
  await ui
    .get(Handles.spaceCreate)
    .expect.visible({ timeoutMs: SPACE_WAIT_MS });
}

export async function waitActiveSpace(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.spaceClose).expect.visible({ timeoutMs: SPACE_WAIT_MS });
}

export async function waitForLobbyCard(
  s: ProductSim,
  actorId: string,
  hostUsername: string
): Promise<string> {
  const handle = Handles.spaceCard(hostUsername);
  const ui = await actorUi(s, actorId);
  let opened = false;
  return pollUntil(
    s,
    async () => {
      if (!opened) {
        await showSpacesTab(s, actorId);
        opened = true;
      }
      if (await ui.get(handle).isVisible()) return handle;
      opened = false;
      return null;
    },
    { maxMs: SPACE_WAIT_MS, description: `lobby card ${handle}` }
  );
}

export async function tapLobbyCard(
  s: ProductSim,
  actorId: string,
  hostUsername: string,
  expectJoinPrompt: boolean
): Promise<void> {
  const handle = await waitForLobbyCard(s, actorId, hostUsername);
  const ui = await actorUi(s, actorId);
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
  if (expectJoinPrompt) {
    await ui.get(Handles.spaceJoin).expect.visible({
      timeoutMs: SPACE_WAIT_MS,
    });
  }
}

export async function leaveToLobby(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.spaceClose).tap({ timeoutMs: SPACE_WAIT_MS });
  await ui
    .get(Handles.spaceCreate)
    .expect.visible({ timeoutMs: SPACE_WAIT_MS });
}

export async function reenterSpace(
  s: ProductSim,
  actorId: string,
  hostUsername: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: SPACE_WAIT_MS,
  });
  if (await ui.get(Handles.spaceClose).isVisible()) {
    await waitActiveSpace(s, actorId);
    return;
  }
  await showSpacesTab(s, actorId);
  await tapLobbyCard(s, actorId, hostUsername, false);
  await waitActiveSpace(s, actorId);
}

export async function tapChromeAction(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
}

export async function confirmSpaceMutation(
  s: ProductSim,
  actorId: string,
  submitHandle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(submitHandle).tap({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(submitHandle).expect.hidden({ timeoutMs: SPACE_HIDDEN_MS });
  await ui.get(Handles.spaceMutationDismiss).tap({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(Handles.spaceMutationDismiss).expect.hidden({
    timeoutMs: SPACE_HIDDEN_MS,
  });
}

/** Every screen a space link or a start can settle on. */
const SPACE_OUTCOMES = [
  Handles.spaceJoin,
  Handles.spaceClose,
  Handles.spaceEnded,
  Handles.spaceNotFound,
  Handles.spacesNeedConnection,
  Handles.spacesHostingLimit,
] as const;

/** Wait until one of `handles` shows; returns which. */
export async function waitForOneOf(
  s: ProductSim,
  actorId: string,
  handles: readonly string[],
  description: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  return pollUntil(
    s,
    async () => {
      for (const handle of handles) {
        if (await ui.get(handle).isVisible()) return handle;
      }
      return null;
    },
    { maxMs: SPACE_WAIT_MS, description }
  );
}

/** Wait until the actor's space screen settles on an outcome. */
export function waitSpaceOutcome(
  s: ProductSim,
  actorId: string,
  description: string
): Promise<string> {
  return waitForOneOf(s, actorId, SPACE_OUTCOMES, description);
}

/**
 * Tap a space chrome action that may have collapsed into the ⋯ menu: straight
 * when it shows, through the menu otherwise.
 */
export async function tapChromeOrOverflow(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.spaceClose).expect.visible({ timeoutMs: SPACE_WAIT_MS });
  if (!(await ui.get(handle).isVisible())) {
    await ui.get(Handles.spaceChromeOverflow).tap({ timeoutMs: SPACE_WAIT_MS });
  }
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
}
