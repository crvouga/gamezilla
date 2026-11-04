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
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
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
 * The filters, with Mark all read at the row's far end while anything is
 * unread: it acts on the list the filters choose, so it sits with them, and
 * the header keeps to the title.
 */
function InboxControls(
  props: NotificationsScreenViewProps & { readonly hasUnread: boolean }
): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal align="center" justify="between" gap="sm" wrap>
      <NotificationsFilterBar
        filter={props.filter}
        onFilterChange={props.onFilterChange}
      />
      <Show when={props.hasUnread}>
        {/* Words, not a glyph: a double check alone does not say what it does. */}
        <Button
          title={t`Mark all read`}
          variant="ghost"
          size="sm"
          loading={props.markingAllRead}
          onClick={() => props.onMarkAllRead()}
          dataSet={{ testid: Handles.notificationsMarkAllRead }}
        />
      </Show>
    </StackHorizontal>
  );
}

function InboxView(props: NotificationsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const hasUnread = (): boolean =>
    props.sections.some((section) =>
      section.items.some((item) => item.isUnread)
    );
  return (
    <CollectionScreen
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      controls={
        <>
          <Show when={props.failure} keyed>
            {(current) => <InboxChoiceFailureNotice failure={current} />}
          </Show>
          <InboxControls {...props} hasUnread={hasUnread()} />
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
 * and permission-denied states. Mark all read ends the filter row, so the
 * header keeps to the title on a phone.
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
