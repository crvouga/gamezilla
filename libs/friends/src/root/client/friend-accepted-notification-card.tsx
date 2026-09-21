import type {
  Notification,
  NotificationCardActions,
} from '@libs/notifications/public';
import { NotificationCardDefault } from '@libs/notifications/public';
import { Handles } from '@libs/test-ids';
import { useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';

function accepterUsername(interaction: Notification): string {
  const username = interaction.payload['toUsername'];
  return typeof username === 'string' ? username : '';
}

/** "@bob accepted your friend request" — opens bob's profile. */
export function FriendAcceptedNotificationCard(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
}): JSX.Element {
  const router = useRouter();

  const onOpen = (): void => {
    void props.actions.markRead(props.interaction.id);
    const deepLink = props.interaction.deepLink;
    if (deepLink === undefined) return;
    router.push({
      pathname: deepLink.path,
      ...(deepLink.params === undefined
        ? {}
        : { params: { ...deepLink.params } }),
    });
  };

  return (
    <NotificationCardDefault
      interaction={props.interaction}
      actions={props.actions}
      onOpen={onOpen}
      {...(accepterUsername(props.interaction).length > 0
        ? {
            testID: Handles.notificationsFriendAcceptedCard(
              accepterUsername(props.interaction)
            ),
          }
        : {})}
    />
  );
}
