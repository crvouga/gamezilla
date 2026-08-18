import { useRouter } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';
import { NotificationCardDefault } from '../../public/notification-card-default';
import { useNotificationRenderProvider } from '../../public/notifications-provider-registry';
import type { Notification } from '../../shared/notifications/notification';
import type { NotificationCardActions } from '../../shared/notifications/notification-action';

export type NotificationCardProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
};

export function NotificationCard({
  interaction,
  actions,
}: NotificationCardProps): ReactNode {
  const router = useRouter();
  const provider = useNotificationRenderProvider(interaction.sourceNamespace);

  const onOpen = useCallback(() => {
    void actions.markRead(interaction.id);
    if (interaction.deepLink === undefined) return;
    router.push({
      pathname: interaction.deepLink.path as never,
      params: interaction.deepLink.params as never,
    });
  }, [actions, interaction.deepLink, interaction.id, router]);

  const onCardPress = useCallback(() => {
    void actions.markRead(interaction.id);
    provider?.onCardPress?.(interaction, actions);
  }, [actions, interaction, provider]);

  const custom = provider?.renderCard?.(interaction, actions);
  if (custom !== undefined && custom !== null) return custom;

  if (provider?.onCardPress !== undefined) {
    return (
      <NotificationCardDefault
        interaction={interaction}
        actions={actions}
        showInlineActions={false}
        onPress={onCardPress}
      />
    );
  }

  return (
    <NotificationCardDefault
      interaction={interaction}
      actions={actions}
      onOpen={onOpen}
    />
  );
}
