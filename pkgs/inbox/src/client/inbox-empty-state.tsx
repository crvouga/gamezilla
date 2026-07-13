import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export function InboxEmptyState(): ReactNode {
  return (
    <Box sx={{ alignItems: 'center', py: 6, gap: 1 }}>
      <Text variant="title" label={<Trans>You&apos;re all caught up</Trans>} />
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={
          <Trans>
            New interactions will show up here when someone reaches out.
          </Trans>
        }
      />
    </Box>
  );
}
