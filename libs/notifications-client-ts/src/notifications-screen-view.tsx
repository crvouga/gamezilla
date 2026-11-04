/** @jsxImportSource solid-js */

import type {
  Notification,
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import { NEEDS_YOU_SECTION_KEY } from '@libs/notifications-shared-ts/notifications-sections';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import type { ScreenBaseAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createMemo, For, type JSX, Show } from 'solid-js';
import type { InboxChoiceFailure } from './inbox-choice-failure';
import { InboxChoiceFailureNotice } from './inbox-choice-failure-notice';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NOTIFICATIONS_FILTER_ALL } from './notifications-filter-values';
import { GroupHeading, NotificationsList } from './notifications-list';

export type NotificationsScreenViewProps = {
  /** The inbox under the current filter, grouped by day. */
  readonly sections: readonly NotificationSection[];
  /** The inbox is still reading; a loader shows below what is known. */
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  /** Why the last inbox choice did not happen, or null. */
  readonly failure: InboxChoiceFailure | null;
  /** Mark all read is in flight. */
  readonly markingAllRead: boolean;
  /** Set when the person may not have an inbox; replaces it. */
  readonly denial?: DenialView | undefined;
  /** One card per notification: drawn by the sub it came from, or the default. */
  readonly renderCard: (interaction: Notification) => JSX.Element;
  readonly onFilterChange: (filter: NotificationFilter) => void;
  readonly onMarkAllRead: () => void;
};

/**
 * Mark all read, while anything is unread: in the header, beside the title,
 * so the filter chips keep a row of their own on a phone instead of
 * pushing it onto an orphaned line of its own.
 */
function useMarkAllReadAction(
  props: NotificationsScreenViewProps,
  hasUnread: () => boolean
) {
  const { t } = useLingui();
  return createMemo((): readonly ScreenBaseAction[] =>
    hasUnread()
      ? [
          {
            // Words, not a glyph: a double check alone does not say what it does.
            type: 'default',
            label: t`Mark all read`,
            loading: props.markingAllRead,
            onClick: () => props.onMarkAllRead(),
            overflow: 'never',
            dataSet: { testid: Handles.notificationsMarkAllRead },
          },
        ]
      : []
  );
}

/**
 * The "Needs you" items when they go in the desktop aside: the whole inbox
 * is shown, something needs the person, and there is a timeline to sit
 * beside. Otherwise the list keeps them as its first group.
 */
function useNeedsYouAside(
  props: NotificationsScreenViewProps
): () => NotificationSection | undefined {
  const mode = useLayoutMode();
  return createMemo(() => {
    if (mode() !== 'wide' || props.filter !== NOTIFICATIONS_FILTER_ALL)
      return undefined;
    const needsYou = props.sections.find(
      (section) =>
        section.key === NEEDS_YOU_SECTION_KEY && section.items.length > 0
    );
    const timeline = props.sections.some(
      (section) =>
        section.key !== NEEDS_YOU_SECTION_KEY && section.items.length > 0
    );
    return timeline ? needsYou : undefined;
  });
}

const NO_SECTION: NotificationSection = { key: '', title: '', items: [] };

/** What waits on the person, in its own column beside the timeline. */
function NeedsYouAside(props: {
  readonly section: NotificationSection;
  readonly renderCard: (interaction: Notification) => JSX.Element;
}): JSX.Element {
  return (
    <StackVertical>
      <GroupHeading
        title={props.section.title}
        count={props.section.items.length}
        leading
      />
      <MenuList>
        <For each={props.section.items}>
          {(item) => (
            <StackVertical paddingX="lg">
              {props.renderCard(item)}
            </StackVertical>
          )}
        </For>
      </MenuList>
    </StackVertical>
  );
}

function InboxView(props: NotificationsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const hasUnread = (): boolean =>
    props.sections.some((section) =>
      section.items.some((item) => item.isUnread)
    );
  const actions = useMarkAllReadAction(props, hasUnread);
  const needsYou = useNeedsYouAside(props);
  const listed = createMemo(() =>
    needsYou() === undefined
      ? props.sections
      : props.sections.filter(
          (section) => section.key !== NEEDS_YOU_SECTION_KEY
        )
  );
  // Nothing at all while there is no aside, so no empty column is
  // reserved; built once per appearance, since the column is read more than
  // once per render.
  const hasAside = createMemo(() => needsYou() !== undefined);
  const aside = createMemo((): JSX.Element | undefined =>
    hasAside() ? (
      <NeedsYouAside
        section={needsYou() ?? NO_SECTION}
        renderCard={props.renderCard}
      />
    ) : undefined
  );
  return (
    <CollectionScreen
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      actions={actions()}
      controls={
        <>
          <Show when={props.failure} keyed>
            {(current) => <InboxChoiceFailureNotice failure={current} />}
          </Show>
          <NotificationsFilterBar
            filter={props.filter}
            onFilterChange={props.onFilterChange}
          />
        </>
      }
      aside={aside()}
    >
      <NotificationsList
        sections={listed()}
        isLoading={props.isLoading}
        filter={props.filter}
        renderCard={props.renderCard}
      />
    </CollectionScreen>
  );
}

/**
 * `/notifications`, presentational: the inbox with its filters, day
 * sections, Mark all read, a failed choice's notice, and its loading, empty
 * and permission-denied states. Mark all read sits in the header beside the
 * title; on a desktop what needs the person sits in a column beside the
 * timeline.
 * `NotificationsScreen` wires it to the inbox and its actions.
 */
export function NotificationsScreenView(
  props: NotificationsScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.denial} fallback={<InboxView {...props} />}>
      {(denial) => (
        <CollectionScreen
          screenId="notifications"
          breadcrumbs={[{ name: t`Notifications` }]}
        >
          <DenialSurfaceView denial={denial()} variant="compact" />
        </CollectionScreen>
      )}
    </Show>
  );
}
