/** @jsxImportSource solid-js */

import type {
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client/screen-body-virtual-list';
import { createMemo, type JSX, Show } from 'solid-js';
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
  const empty = createMemo(
    () =>
      !props.isLoading &&
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
        <label class="text textLabel text-text-secondary pb-1 pt-3">
          {row.title}
        </label>
      );
    }
    if (row.kind === 'loading') {
      return <LoadingState variant="compact" size="small" />;
    }
    return (
      <NotificationCard interaction={row.interaction} actions={props.actions} />
    );
  };

  return (
    <Show
      when={!empty()}
      fallback={
        <div class="box flex-1">
          <NotificationsEmptyState filter={props.filter} />
        </div>
      }
    >
      <ScreenBodyVirtualList
        items={rows()}
        keyExtractor={(row) => row.key}
        estimateSize={88}
        renderItem={renderItem}
      />
    </Show>
  );
}
