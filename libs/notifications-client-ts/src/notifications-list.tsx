/** @jsxImportSource solid-js */

import type {
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import type { NotificationCardActions } from '@libs/notifications-shared-ts/notification-action';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { NotificationCard } from './notification-card';
import { NotificationsEmptyState } from './notifications-empty-state';

type NotificationsListProps = {
  readonly sections: readonly NotificationSection[];
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  readonly actions: NotificationCardActions;
};

type ListRow =
  | {
      readonly kind: 'header';
      readonly key: string;
      readonly title: JSX.Element;
    }
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly interaction: NotificationSection['items'][number];
    }
  | { readonly kind: 'loading'; readonly key: 'loading' };

export function NotificationsList(props: NotificationsListProps): JSX.Element {
  const noItems = createMemo(() =>
    props.sections.every((section) => section.items.length === 0)
  );

  const rows = createMemo((): ListRow[] => {
    const out: ListRow[] = [];
    for (const section of props.sections) {
      if (section.items.length === 0) continue;
      out.push({
        kind: 'header',
        key: `h:${section.key}`,
        title: section.title,
      });
      for (const interaction of section.items) {
        out.push({ kind: 'item', key: interaction.id, interaction });
      }
    }
    if (props.isLoading) {
      out.push({ kind: 'loading', key: 'loading' });
    }
    return out;
  });

  const renderItem = (row: ListRow): JSX.Element => {
    if (row.kind === 'header') {
      return (
        <StackVertical paddingTop="lg" paddingBottom="xs">
          <H2 size="label" tone="secondary">
            {row.title}
          </H2>
        </StackVertical>
      );
    }
    if (row.kind === 'loading') {
      return <LoadingState variant="compact" size="sm" />;
    }
    return (
      <NotificationCard interaction={row.interaction} actions={props.actions} />
    );
  };

  return (
    <Switch
      fallback={
        <ScreenBodyVirtualList
          items={rows()}
          keyExtractor={(row) => row.key}
          estimateSize={88}
          renderItem={renderItem}
        />
      }
    >
      <Match when={noItems() && props.isLoading}>
        <LoadingState />
      </Match>
      <Match when={noItems()}>
        <StackVertical grow>
          <NotificationsEmptyState filter={props.filter} />
        </StackVertical>
      </Match>
    </Switch>
  );
}
