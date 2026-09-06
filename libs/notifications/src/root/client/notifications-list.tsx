import {
  Box,
  LoadingState,
  SCREEN_BODY_PADDING_STEP,
  ScreenBodyLegendList,
  Text,
} from '@pkgs/ui-rn';
import { type ReactNode, useCallback, useMemo } from 'react';

import type {
  NotificationFilter,
  NotificationSection,
} from '../../shared/notifications/notification';
import type { NotificationCardActions } from '../../shared/notifications/notification-action';
import { NotificationCard } from './notification-card';
import { NotificationsEmptyState } from './notifications-empty-state';

type NotificationsListProps = {
  readonly sections: readonly NotificationSection[];
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  readonly actions: NotificationCardActions;
};

type ListRow =
  | { readonly kind: 'header'; readonly key: string; readonly title: ReactNode }
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly interaction: NotificationSection['items'][number];
    }
  | { readonly kind: 'loading'; readonly key: 'loading' };

export function NotificationsList({
  sections,
  isLoading,
  filter,
  actions,
}: NotificationsListProps): ReactNode {
  const empty =
    !isLoading && sections.every((section) => section.items.length === 0);

  const rows = useMemo((): ListRow[] => {
    const out: ListRow[] = [];
    for (const section of sections) {
      if (section.items.length === 0) continue;
      out.push({
        kind: 'header',
        key: `h:${section.key}`,
        title: section.title,
      });
      for (const interaction of section.items) {
        out.push({
          kind: 'item',
          key: interaction.id,
          interaction,
        });
      }
    }
    if (isLoading) {
      out.push({ kind: 'loading', key: 'loading' });
    }
    return out;
  }, [isLoading, sections]);

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.kind === 'header') {
        return (
          <Text
            variant="label"
            label={item.title}
            sx={{
              color: 'textSecondary',
              px: SCREEN_BODY_PADDING_STEP,
              pb: 1,
              pt: 3,
            }}
          />
        );
      }
      if (item.kind === 'loading') {
        return <LoadingState variant="compact" size="small" />;
      }
      return (
        <NotificationCard interaction={item.interaction} actions={actions} />
      );
    },
    [actions]
  );

  if (empty) {
    return (
      <Box sx={{ flex: 1, px: SCREEN_BODY_PADDING_STEP }}>
        <NotificationsEmptyState filter={filter} />
      </Box>
    );
  }

  return (
    <ScreenBodyLegendList
      data={rows}
      keyExtractor={(row) => row.key}
      estimatedItemSize={88}
      drawDistance={200}
      renderItem={renderItem}
    />
  );
}
