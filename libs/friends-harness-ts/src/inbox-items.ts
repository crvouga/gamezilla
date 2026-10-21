/**
 * What a person does with one inbox item: open it, mark the inbox read,
 * set it aside, and look at one list. Reads are what that inbox shows.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { visible } from '@libs/harness-ts/observations';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { openInbox } from '@libs/notifications-harness-ts/notifications-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 15_000;

const LIST_HANDLE = {
  ordinary: Handles.notificationsFilterAll,
  waiting: Handles.notificationsFilterWaiting,
  archived: Handles.notificationsFilterArchived,
} as const;

export type InboxList = keyof typeof LIST_HANDLE;

async function onInbox(s: ProductHarness, actorId: string): Promise<void> {
  await Promise.resolve(focusActor.act(s, actorId));
  const ui = await actorUi(s, actorId);
  // Tapping the inbox tab again would leave the list the person already chose.
  if (await ui.get(Handles.notificationsFilterAll).isVisible()) return;
  await Promise.resolve(openInbox.act(s, actorId));
}

/** Open the friend request. With a connection it is marked opened. */
export const openInboxItem = scenarioAction({
  name: 'openInboxItem',
  act: async (s, actorId: string, fromUsername: string) => {
    await onInbox(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Mark every waiting inbox item opened. */
export const markInboxRead = scenarioAction({
  name: 'markInboxRead',
  act: async (s, actorId: string) => {
    await onInbox(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.notificationsMarkAllRead).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Set the friend request aside, into the archived inbox. */
export const archiveInboxItem = scenarioAction({
  name: 'archiveInboxItem',
  act: async (s, actorId: string, fromUsername: string) => {
    await onInbox(s, actorId);
    const ui = await actorUi(s, actorId);
    const card = Handles.notificationsFriendRequestCard(fromUsername);
    await ui
      .get(Handles.notificationsArchive(card))
      .tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Look at one inbox list. The items stay where they are. */
export const chooseInboxList = scenarioAction({
  name: 'chooseInboxList',
  act: async (s, actorId: string, list: InboxList) => {
    await onInbox(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(LIST_HANDLE[list]).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** "waiting", "opened", or null when that friend request is not on screen. */
export async function inboxItemState(
  s: ProductHarness,
  actorId: string,
  fromUsername: string
): Promise<string | null> {
  const ui = await actorUi(s, actorId);
  const card = ui.get(Handles.notificationsFriendRequestCard(fromUsername));
  if (!(await card.isVisible())) return null;
  return card.attribute('data-inbox-state');
}

/** The inbox says the connection is missing. */
export async function connectionMissingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.notificationsConnectionMissing]);
}
