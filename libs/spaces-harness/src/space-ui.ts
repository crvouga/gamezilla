import { actorUi, pollUntil } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorHtml } from '@libs/harness/observations';
import { backToTabs } from '@libs/harness/shell-actions';
import { Handles } from '@libs/test-ids-shared/handles';

export const SPACE_WAIT_MS = 10_000;
export const SPACE_HIDDEN_MS = 5_000;

export async function showSpacesTab(
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.spaceClose).expect.visible({ timeoutMs: SPACE_WAIT_MS });
}

export async function waitForLobbyCard(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await showSpacesTab(s, actorId);
}

/** Coming back after the app reopened can take longer than a tap. */
const OWN_SPACE_WAIT_MS = 15_000;
const OWN_SPACE_POLL_MS = 250;

/** The lobby card of the one space the actor is in, from the Spaces tab. */
export async function ownSpaceCard(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  await showSpacesTab(s, actorId);
  const html = await actorHtml(s, actorId);
  const cards = [
    ...(html ?? '').matchAll(/data-testid="(space-card-[^"]+)"/g),
  ].map((match) => match[1] ?? '');
  if (cards.length === 1) return cards[0] ?? null;
  const saved = [
    ...(html ?? '').matchAll(/data-testid="(space-miniplayer-open-[^"]+)"/g),
  ].map((match) => match[1] ?? '');
  return saved.length === 1 ? (saved[0] ?? null) : null;
}

/**
 * Back into the one space the actor is in, from wherever the app opened
 * (the space itself, or the tabs with the space open behind them), through
 * its lobby card. Works for a guest too, whose card carries a username the
 * scenario never chose.
 */
export async function reenterOwnSpace(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.statusCurrentUser)
    .expect.visible({ timeoutMs: OWN_SPACE_WAIT_MS });
  if (!(await ui.get(Handles.spaceClose).isVisible())) {
    const card = await pollUntil(s, () => ownSpaceCard(s, actorId), {
      maxMs: OWN_SPACE_WAIT_MS,
      stepMs: OWN_SPACE_POLL_MS,
      description: `${actorId}'s own space card`,
    });
    await ui.get(card).tap({ timeoutMs: OWN_SPACE_WAIT_MS });
  }
  await waitActiveSpace(s, actorId);
}

const TRY_RETURN_MS = 2_000;

/**
 * Back into the one space this device knows, when its lobby card is there.
 * A device that has not met the space stays on the lobby.
 */
export async function tryReenterOwnSpace(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.spaceClose).isVisible()) return;
  const card = await pollUntil(s, () => ownSpaceCard(s, actorId), {
    maxMs: TRY_RETURN_MS,
    stepMs: OWN_SPACE_POLL_MS,
    description: `${actorId}'s own space card`,
  }).catch(() => null);
  if (card === null) return;
  await ui.get(card).tap({ timeoutMs: SPACE_WAIT_MS });
  await waitActiveSpace(s, actorId);
}

export async function reenterSpace(
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
}

export async function confirmSpaceMutation(
  s: ProductHarness,
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
  Handles.spaceHostOffline,
  Handles.spaceNotFound,
  Handles.spacesNeedConnection,
  Handles.spacesHostingLimit,
] as const;

/** Wait until one of `handles` shows; returns which. */
export async function waitForOneOf(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(handle).isVisible()) {
    await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
    return;
  }
  await ui
    .get(Handles.spaceClose)
    .expect.visible({ timeoutMs: SPACE_WAIT_MS })
    .catch(async (error) => {
      const live = await s.harness.spawnClient(actorId);
      const engine = live.syncEnginePool.peekReady(
        live.env.resolveDatabaseName({ userId: '' })
      );
      throw new Error(
        `${String(error)}; sync=${JSON.stringify(engine?.status.getSnapshot())}`
      );
    });
  if (!(await ui.get(handle).isVisible())) {
    await ui.get(Handles.spaceChromeOverflow).tap({ timeoutMs: SPACE_WAIT_MS });
  }
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
}
