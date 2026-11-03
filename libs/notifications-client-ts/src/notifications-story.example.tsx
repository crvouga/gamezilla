/** @jsxImportSource solid-js */
/**
 * Story fixtures for the inbox: deterministic notifications dated against
 * the Storybook virtual clock (2023-11-14T22:13:20Z), and the default card
 * the app draws for a notification no sub renders itself.
 */

import type {
  Notification,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import type { NotificationCardActions } from '@libs/notifications-shared-ts/notification-action';
import { notificationCardTestId } from '@libs/notifications-shared-ts/notification-id';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { NotificationCardDefault } from './notification-card-default';

/** A notification with every optional field unset; override what matters. */
export function storyNotification(
  overrides: Partial<Notification> & Pick<Notification, 'id' | 'title'>
): Notification {
  return {
    sourceNamespace: 'spaces',
    sourceType: 'space_invite',
    sourceId: overrides.id,
    category: 'informational',
    createdAt: '2023-11-14T21:00:00.000Z',
    priority: 0,
    actions: [],
    payload: {},
    isUnread: false,
    isArchived: false,
    isDismissed: false,
    isActive: true,
    ...overrides,
  };
}

/** Inbox actions that do nothing but record the call. */
export function storyCardActions(): NotificationCardActions {
  return {
    performAction: fn(() => Promise.resolve()).mockName('performAction'),
    markRead: fn(() => Promise.resolve()).mockName('markRead'),
    archive: fn(() => Promise.resolve()).mockName('archive'),
  };
}

/** The default card, wired the way the inbox wires a card no sub draws. */
export function storyDefaultCard(
  actions: NotificationCardActions
): (interaction: Notification) => JSX.Element {
  return (interaction) => {
    const testID = notificationCardTestId({
      namespace: interaction.sourceNamespace,
      type: interaction.sourceType,
      id: interaction.sourceId,
    });
    return (
      <NotificationCardDefault
        interaction={interaction}
        actions={actions}
        onOpen={() => undefined}
        testID={testID}
        actionTestID={(action) => `${testID}-${action.id}`}
      />
    );
  };
}

/** One section per title, in the order given. */
export function storySections(
  groups: readonly (readonly [string, readonly Notification[]])[]
): readonly NotificationSection[] {
  return groups.map(([title, items]) => ({
    key: title.toLowerCase().replace(/\s+/g, '_'),
    title,
    items,
  }));
}
