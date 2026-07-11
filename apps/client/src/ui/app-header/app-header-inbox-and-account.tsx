import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { InboxHeaderButton } from '@pkgs/inbox/client';
import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function AppHeaderInboxAndAccount(): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      <InboxHeaderButton />
      <AppAccountMenu />
    </Box>
  );
}
