import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import {
  expectShellShown,
  minimizeSpace,
  spaceBarShown,
} from '@libs/harness-ts/driver-gestures';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml } from '@libs/harness-ts/observations';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

export const SPACE_WAIT_MS = 10_000;
export const SPACE_HIDDEN_MS = 5_000;

export async function showSpacesTab(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await expectShellShown(ui, SPACE_WAIT_MS);
  // Out of an open space (still in it) or a stacked screen, as a person
  // would, before reaching for the tab.
  if (await spaceBarShown(ui)) {
    await minimizeSpace(ui, SPACE_WAIT_MS);
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
  await waitForOneOf(
    s,
    actorId,
    [Handles.spaceClose],
    `${actorId} inside the space`
  );
}

type Ui = Awaited<ReturnType<typeof actorUi>>;

/** Minimize is also on the loading shell. Only the joined space owns its body. */
async function outcomeShown(ui: Ui, handle: string): Promise<boolean> {
  if (handle !== Handles.spaceClose) return ui.get(handle).isVisible();
  // regression: space-loading-shell-reads-as-inside
  // regression: space-loading-shell-gone-between-reads
  return (
    (await ui.get(Handles.spaceActive).isVisible()) &&
    !(await ui.get(Handles.spaceLoading).isVisible())
  );
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
  await expectShellShown(ui, OWN_SPACE_WAIT_MS);
  if (!(await spaceBarShown(ui))) {
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
  if (await spaceBarShown(ui)) return;
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
  await expectShellShown(ui, SPACE_WAIT_MS);
  if (await spaceBarShown(ui)) {
    await waitActiveSpace(s, actorId);
    return;
  }
  await showSpacesTab(s, actorId);
  await tapLobbyCard(s, actorId, hostUsername, false);
  await waitActiveSpace(s, actorId);
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

export const SPACE_LINK_RECOVERY = [
  Handles.spaceEnded,
  Handles.spaceJoinUnavailable,
  Handles.spaceNotFound,
  Handles.spaceHostOffline,
  Handles.spacesNeedConnection,
  Handles.spaceUnreachable,
] as const;

/** Every screen a space link or a start can settle on. */
const SPACE_OUTCOMES = [
  Handles.spaceJoin,
  Handles.spaceClose,
  ...SPACE_LINK_RECOVERY,
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
        if (await outcomeShown(ui, handle)) return handle;
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
 * After a space link opened: the join prompt shows, or the person is
 * already in the space. Anything else (no connection, the host offline, an
 * ended space) fails, naming what the person saw.
 */
export async function expectJoinPrompt(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<void> {
  const outcome = await waitSpaceOutcome(s, actorId, `space link ${link}`);
  if (outcome === Handles.spaceJoin || outcome === Handles.spaceClose) return;
  throw new Error(
    `${actorId} opened ${link} and saw ${outcome} instead of the join prompt`
  );
}

/** Press an action in the open space's top bar. */
export async function tapSpaceAction(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (handle === Handles.spaceRename && !(await ui.get(handle).isVisible())) {
    await ui.get(Handles.spaceSettings).tap({ timeoutMs: SPACE_WAIT_MS });
  }
  await ui.get(handle).tap({ timeoutMs: SPACE_WAIT_MS });
}
