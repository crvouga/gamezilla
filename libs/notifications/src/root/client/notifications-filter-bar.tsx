import { Trans } from '@lingui/react/macro';
import { ChipGroup, type ChipGroupOption } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import type { NotificationFilter } from '../../shared/notifications/notification';
import {
  NOTIFICATIONS_FILTER_ACTION_REQUIRED,
  NOTIFICATIONS_FILTER_ALL,
  NOTIFICATIONS_FILTER_ARCHIVED,
} from './notifications-filter-values';

type NotificationsFilterBarProps = {
  readonly filter: NotificationFilter;
  readonly onFilterChange: (filter: NotificationFilter) => void;
};

const FILTER_OPTIONS: readonly ChipGroupOption<NotificationFilter>[] = [
  { key: NOTIFICATIONS_FILTER_ALL, label: <Trans>All</Trans> },
  {
    key: NOTIFICATIONS_FILTER_ACTION_REQUIRED,
    label: <Trans>Action required</Trans>,
  },
  { key: NOTIFICATIONS_FILTER_ARCHIVED, label: <Trans>Archived</Trans> },
];

export function NotificationsFilterBar({
  filter,
  onFilterChange,
}: NotificationsFilterBarProps): ReactNode {
  return (
    <ChipGroup
      options={FILTER_OPTIONS}
      selected={filter}
      onSelect={onFilterChange}
    />
  );
}
