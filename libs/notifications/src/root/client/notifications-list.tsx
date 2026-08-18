import { Trans } from '@lingui/react/macro';
import { Box, SCREEN_BODY_PADDING_STEP, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { NotificationSection } from '../shared/notification';
import type { NotificationCardActions } from '../shared/notification-action';
import { NotificationCard } from './notification-card';
import { NotificationsEmptyState } from './notifications-empty-state';

type NotificationsListProps = {
  readonly sections: readonly NotificationSection[];
  readonly isLoading: boolean;
  readonly actions: NotificationCardActions;
};

export function NotificationsList({
  sections,
  isLoading,
  actions,
}: NotificationsListProps): ReactNode {
  if (!isLoading && sections.every((section) => section.items.length === 0)) {
    return (
      <Box sx={{ px: SCREEN_BODY_PADDING_STEP }}>
        <NotificationsEmptyState />
      </Box>
    );
  }

  return (
    <Box sx={{ gap: 3 }}>
      {sections.map((section) => (
        <Box key={section.key}>
          <Text
            variant="caption"
            label={section.title}
            sx={{
              color: 'textSecondary',
              px: SCREEN_BODY_PADDING_STEP,
              pb: 0.5,
            }}
          />
          {section.items.map((interaction) => (
            <NotificationCard
              key={interaction.id}
              interaction={interaction}
              actions={actions}
            />
          ))}
        </Box>
      ))}
      {isLoading ? (
        <Text
          variant="body"
          label={<Trans>Loading…</Trans>}
          sx={{ color: 'textSecondary', px: SCREEN_BODY_PADDING_STEP }}
        />
      ) : null}
    </Box>
  );
}
