/** @jsxImportSource solid-js */

import type { NotificationFilter } from '@libs/notifications-shared-ts/notification';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import type { ChipGroupOption } from '@pkgs/ui-root-client-ts/chip-group';
import { ChipGroup } from '@pkgs/ui-root-client-ts/chip-group';
import type { JSX } from 'solid-js';
import {
  NOTIFICATIONS_FILTER_ACTION_REQUIRED,
  NOTIFICATIONS_FILTER_ALL,
  NOTIFICATIONS_FILTER_ARCHIVED,
} from './notifications-filter-values';

type NotificationsFilterBarProps = {
  readonly filter: NotificationFilter;
  readonly onFilterChange: (filter: NotificationFilter) => void;
};

export function NotificationsFilterBar(
  props: NotificationsFilterBarProps
): JSX.Element {
  const { t } = useLingui();
  const options = (): readonly ChipGroupOption<NotificationFilter>[] => [
    {
      key: NOTIFICATIONS_FILTER_ALL,
      label: t`All`,
      testid: Handles.notificationsFilterAll,
    },
    {
      key: NOTIFICATIONS_FILTER_ACTION_REQUIRED,
      label: t`Action required`,
      testid: Handles.notificationsFilterWaiting,
    },
    {
      key: NOTIFICATIONS_FILTER_ARCHIVED,
      label: t`Archived`,
      testid: Handles.notificationsFilterArchived,
    },
  ];
  return (
    <ChipGroup
      options={options()}
      selected={props.filter}
      onSelect={props.onFilterChange}
    />
  );
}
