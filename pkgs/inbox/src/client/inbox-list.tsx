import { Trans } from '@lingui/react/macro';
import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { InteractionSection } from '../shared/interaction';
import type { InteractionCardActions } from '../shared/interaction-action';
import { InboxEmptyState } from './inbox-empty-state';
import { InteractionCard } from './interaction-card';

type InboxListProps = {
  readonly sections: readonly InteractionSection[];
  readonly isLoading: boolean;
  readonly actions: InteractionCardActions;
};

export function InboxList({
  sections,
  isLoading,
  actions,
}: InboxListProps): ReactNode {
  if (!isLoading && sections.every((section) => section.items.length === 0)) {
    return <InboxEmptyState />;
  }

  return (
    <Box sx={{ gap: 3 }}>
      {sections.map((section) => (
        <Box key={section.key} sx={{ gap: 2 }}>
          <Text
            variant="caption"
            label={section.title}
            sx={{ color: 'textSecondary' }}
          />
          {section.items.map((interaction) => (
            <InteractionCard
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
          sx={{ color: 'textSecondary' }}
        />
      ) : null}
    </Box>
  );
}
