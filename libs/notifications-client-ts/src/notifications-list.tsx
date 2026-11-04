/** @jsxImportSource solid-js */

import type {
  Notification,
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { VirtualListPanelPlace } from '@pkgs/ui-root-client-ts/virtual-list';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { NotificationsEmptyState } from './notifications-empty-state';

type NotificationsListProps = {
  readonly sections: readonly NotificationSection[];
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  /** One card per notification: drawn by the sub it came from, or the default. */
  readonly renderCard: (interaction: Notification) => JSX.Element;
};

type ListRow =
  | {
      readonly kind: 'header';
      readonly key: string;
      readonly title: JSX.Element;
      /** The first day: no gap above it. */
      readonly leading: boolean;
    }
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly interaction: NotificationSection['items'][number];
      /** Where the row sits in its day's panel. */
      readonly place: VirtualListPanelPlace;
    }
  | { readonly kind: 'loading'; readonly key: 'loading' };

/** A day's items share one panel: where item `index` of `count` sits. */
function itemPlace(index: number, count: number): VirtualListPanelPlace {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

function rowPlace(row: ListRow): VirtualListPanelPlace {
  return row.kind === 'item' ? row.place : 'heading';
}

/** The inbox's day sections, a trailing loader while more load, or its empty state. */
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
        leading: out.length === 0,
      });
      section.items.forEach((interaction, index) => {
        out.push({
          kind: 'item',
          key: interaction.id,
          interaction,
          place: itemPlace(index, section.items.length),
        });
      });
    }
    if (props.isLoading) {
      out.push({ kind: 'loading', key: 'loading' });
    }
    return out;
  });

  const renderItem = (row: ListRow): JSX.Element => {
    if (row.kind === 'header') {
      // The label on the rows' text column, a small gap to its panel, and a
      // tighter gap than a settings section above every day but the first:
      // the inbox is one running list, so more of it fits on a phone.
      return (
        <StackVertical
          paddingX="lg"
          paddingTop={row.leading ? 'none' : 'lg'}
          paddingBottom="sm"
        >
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
      <StackVertical paddingX="lg">
        {props.renderCard(row.interaction)}
      </StackVertical>
    );
  };

  return (
    <Switch
      fallback={
        <ScreenBodyVirtualList
          items={rows()}
          keyExtractor={(row) => row.key}
          estimateSize={72}
          renderItem={renderItem}
          panelGroups={rowPlace}
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
