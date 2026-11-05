/** @jsxImportSource solid-js */

import type {
  Notification,
  NotificationFilter,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import type { ScreenBaseAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import { createMemo, type JSX, Show } from 'solid-js';
import type { InboxChoiceFailure } from './inbox-choice-failure';
import { InboxChoiceFailureNotice } from './inbox-choice-failure-notice';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';

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

function InboxView(props: NotificationsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const hasUnread = (): boolean =>
    props.sections.some((section) =>
      section.items.some((item) => item.isUnread)
    );
  const actions = useMarkAllReadAction(props, hasUnread);
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
    >
      <NotificationsList
        sections={props.sections}
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
 * title. On every size the inbox is one list: what needs the person first,
 * then the Activity timeline under it, so the "All" filter shows all of it
 * in one place. A desktop gives it the content column every other page
 * has, from the breadcrumb's edge to the column's end, each card's answers
 * and "…" together at the row's end.
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
