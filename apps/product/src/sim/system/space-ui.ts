import { Handles } from '@libs/test-ids';

import { actorUi, pollUntil } from './actor-ui';
import type { ProductSim } from './sim';

export const SCREEN_SPACES = 'screen-spaces';
export const SCREEN_SPACE_JOIN = 'screen-space-join';
export const SCREEN_SPACE_ENDED = 'screen-space-ended';

export const SPACE_WAIT_MS = 10_000;
export const SPACE_HIDDEN_MS = 5_000;

export async function showSpacesTab(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.tabSpaces).tap({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(SCREEN_SPACES).expect.visible({ timeoutMs: SPACE_WAIT_MS });
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
    await ui.get(SCREEN_SPACE_JOIN).expect.visible({
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
  await ui.get(SCREEN_SPACES).expect.visible({ timeoutMs: SPACE_WAIT_MS });
}

export async function reenterSpace(
  s: ProductSim,
  actorId: string,
  hostUsername: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
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
