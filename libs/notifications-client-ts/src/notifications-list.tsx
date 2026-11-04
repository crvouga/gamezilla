/** @jsxImportSource solid-js */

import type {
  Notification,
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import { NEEDS_YOU_SECTION_KEY } from '@libs/notifications-shared-ts/notifications-sections';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { H2, H3 } from '@pkgs/ui-root-client-ts/heading';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { VirtualListPanelPlace } from '@pkgs/ui-root-client-ts/virtual-list';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { NotificationsEmptyState } from './notifications-empty-state';

type NotificationsListProps = {
  readonly sections: readonly NotificationSection[];
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  /** One card per notification: drawn by the sub it came from, or the default. */
  readonly renderCard: (interaction: Notification) => JSX.Element;
};

export type ListRow =
  | {
      /**
       * One of the inbox's two groups: "Needs you" (with how many) above the
       * "Activity" timeline.
       */
      readonly kind: 'group';
      readonly key: string;
      readonly title: JSX.Element;
      readonly count: number | null;
      /** The first row: no gap above it. */
      readonly leading: boolean;
    }
  | {
      readonly kind: 'header';
      readonly key: string;
      readonly title: JSX.Element;
      /** The first day, or the first under a group heading: no gap above it. */
      readonly leading: boolean;
      /** A day inside the Activity group, one level under its heading. */
      readonly nested: boolean;
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

function pushItems(out: ListRow[], section: NotificationSection): void {
  section.items.forEach((interaction, index) => {
    out.push({
      kind: 'item',
      key: interaction.id,
      interaction,
      place: itemPlace(index, section.items.length),
    });
  });
}

/**
 * The inbox as rows. When something needs the person, the inbox is two
 * groups, each with its own heading: "Needs you" first, then the "Activity"
 * timeline, whose days sit one level under it. Otherwise it is the timeline
 * alone, by day.
 */
export function notificationRows(
  sections: readonly NotificationSection[],
  activityTitle: JSX.Element
): ListRow[] {
  const out: ListRow[] = [];
  const shown = sections.filter((section) => section.items.length > 0);
  const grouped = shown.some(
    (section) => section.key === NEEDS_YOU_SECTION_KEY
  );
  let activityOpen = false;
  for (const section of shown) {
    if (section.key === NEEDS_YOU_SECTION_KEY) {
      out.push({
        kind: 'group',
        key: `g:${section.key}`,
        title: section.title,
        count: section.items.length,
        leading: out.length === 0,
      });
      pushItems(out, section);
      continue;
    }
    const opensActivity = grouped && !activityOpen;
    if (opensActivity) {
      activityOpen = true;
      out.push({
        kind: 'group',
        key: 'g:activity',
        title: activityTitle,
        count: null,
        leading: out.length === 0,
      });
    }
    out.push({
      kind: 'header',
      key: `h:${section.key}`,
      title: section.title,
      leading: out.length === 0 || opensActivity,
      nested: grouped,
    });
    pushItems(out, section);
  }
  return out;
}

/** A group's heading: larger than a day's, with how many need the person. */
export function GroupHeading(props: {
  readonly title: JSX.Element;
  readonly count: number | null;
  readonly leading: boolean;
}): JSX.Element {
  return (
    <StackHorizontal
      align="center"
      gap="sm"
      paddingX="lg"
      paddingTop={props.leading ? 'none' : 'xl'}
      paddingBottom="sm"
    >
      <H2 size="subtitle">{props.title}</H2>
      <Show when={props.count}>
        {(count) => (
          <Badge
            label={String(count())}
            intent="brand"
            tone="solid"
            size="sm"
          />
        )}
      </Show>
    </StackHorizontal>
  );
}

/** A day's label, a level under the Activity heading when there is one. */
function DayHeading(props: {
  readonly title: JSX.Element;
  readonly leading: boolean;
  readonly nested: boolean;
}): JSX.Element {
  // The label on the rows' text column, a small gap to its panel, and a
  // tighter gap than a settings section above every day but the first:
  // the inbox is one running list, so more of it fits on a phone.
  return (
    <StackVertical
      paddingX="lg"
      paddingTop={props.leading ? 'none' : 'lg'}
      paddingBottom="sm"
    >
      <Show
        when={props.nested}
        fallback={
          <H2 size="label" tone="secondary">
            {props.title}
          </H2>
        }
      >
        <H3 size="label" tone="secondary">
          {props.title}
        </H3>
      </Show>
    </StackVertical>
  );
}

/** The inbox's day sections, a trailing loader while more load, or its empty state. */
export function NotificationsList(props: NotificationsListProps): JSX.Element {
  const noItems = createMemo(() =>
    props.sections.every((section) => section.items.length === 0)
  );

  const rows = createMemo((): ListRow[] => {
    const out = notificationRows(props.sections, <Trans>Activity</Trans>);
    if (props.isLoading) {
      out.push({ kind: 'loading', key: 'loading' });
    }
    return out;
  });

  const renderItem = (row: ListRow): JSX.Element => {
    if (row.kind === 'group') {
      return (
        <GroupHeading
          title={row.title}
          count={row.count}
          leading={row.leading}
        />
      );
    }
    if (row.kind === 'header') {
      return (
        <DayHeading
          title={row.title}
          leading={row.leading}
          nested={row.nested}
        />
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
