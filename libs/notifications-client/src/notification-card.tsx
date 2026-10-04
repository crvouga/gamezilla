/** @jsxImportSource solid-js */

import type { Notification } from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import { useRouter } from '@pkgs/ui-client/app-router';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { NotificationCardDefault } from './notification-card-default';
import { useNotificationRenderProvider } from './notifications-provider-registry';

export type NotificationCardProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
};

export function NotificationCard(props: NotificationCardProps): JSX.Element {
  const router = useRouter();
  const provider = useNotificationRenderProvider(
    () => props.interaction.sourceNamespace
  );

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

  const onCardPress = (): void => {
    void props.actions.markRead(props.interaction.id);
    provider()?.onCardPress?.(props.interaction, props.actions);
  };

  const customCard = createMemo<JSX.Element | null>(() => {
    const rendered = provider()?.renderCard?.(props.interaction, props.actions);
    return rendered === undefined || rendered === null ? null : rendered;
  });

  return (
    <Switch>
      <Match when={customCard()} keyed>
        {(card) => card}
      </Match>
      <Match when={provider()?.onCardPress !== undefined}>
        <NotificationCardDefault
          interaction={props.interaction}
          actions={props.actions}
          showInlineActions={false}
          onPress={onCardPress}
        />
      </Match>
      <Match when={true}>
        <NotificationCardDefault
          interaction={props.interaction}
          actions={props.actions}
          onOpen={onOpen}
        />
      </Match>
    </Switch>
  );
}
