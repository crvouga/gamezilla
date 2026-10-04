/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { ChipGroup } from '@pkgs/ui-client/chip-group';
import type { ChipGroupOption } from '@pkgs/ui-client/chip-group';
import type { JSX } from 'solid-js';

import type { NotificationFilter } from '@libs/notifications-shared/notification';
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
    { key: NOTIFICATIONS_FILTER_ALL, label: t`All` },
    {
      key: NOTIFICATIONS_FILTER_ACTION_REQUIRED,
      label: t`Action required`,
    },
    { key: NOTIFICATIONS_FILTER_ARCHIVED, label: t`Archived` },
  ];
  return (
    <ChipGroup
      options={options()}
      selected={props.filter}
      onSelect={props.onFilterChange}
    />
  );
}
