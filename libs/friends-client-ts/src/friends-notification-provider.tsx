import type { Notification } from '@libs/notifications-shared-ts/notification';
import type { NotificationCardActions } from '@libs/notifications-shared-ts/notification-action';
import type { NotificationProvider } from '@libs/notifications-shared-ts/notification-provider';
import { createComponent, type JSX } from 'solid-js';

import { FriendAcceptedNotificationCard } from './friend-accepted-notification-card';
import { FriendRequestNotificationCard } from './friend-request-notification-card';
import type { FriendsClientDeps } from './friends-client-deps';

type FriendsCard = (props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
}) => JSX.Element;

/** The card for each friends notification source; others are not ours. */
const CARDS: Readonly<Record<string, FriendsCard>> = {
  'friend-request': FriendRequestNotificationCard,
  'friend-request-accepted': FriendAcceptedNotificationCard,
};

/**
 * `renderCard` must return `null` for a source it does not draw: the inbox
 * falls back to its default card only then. (A `<Show>` is never null, so
 * wrapping the cards in one blanked every other friends notification.)
 */
export function createFriendsNotificationProvider(
  _deps: FriendsClientDeps
): NotificationProvider {
  return {
    id: 'friends',
    renderCard: (interaction, actions) => {
      const Card = CARDS[interaction.sourceType];
      return Card === undefined
        ? null
        : createComponent(Card, { interaction, actions });
    },
  };
}
