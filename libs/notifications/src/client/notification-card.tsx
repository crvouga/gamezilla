import { useRouter } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import type { Notification } from '../shared/notification';
import type { NotificationCardActions } from '../shared/notification-action';
import { NotificationCardDefault } from './notification-card-default';
import { useNotificationRenderProvider } from './notifications-provider-registry';

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
