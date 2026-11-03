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
import { CheckCheckIcon } from '@pkgs/ui-root-client-ts/icons';
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

function InboxView(props: NotificationsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const hasUnread = (): boolean =>
    props.sections.some((section) =>
      section.items.some((item) => item.isUnread)
    );
  const headerActions = createMemo((): readonly ScreenBaseAction[] =>
    hasUnread()
      ? [
          {
            type: 'default',
            label: t`Mark all read`,
            icon: CheckCheckIcon,
            loading: props.markingAllRead,
            onClick: () => props.onMarkAllRead(),
            overflow: 'never',
            dataSet: { testid: Handles.notificationsMarkAllRead },
          },
        ]
      : []
  );
  return (
    <CollectionScreen
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      actions={headerActions()}
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
 * and permission-denied states. Marking everything read is a screen action,
 * so it is handed to the header rather than squeezed beside the filters.
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
