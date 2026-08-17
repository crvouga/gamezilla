import { Trans } from '@lingui/react/macro';
import { BellIcon, EmptyState } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function NotificationsEmptyState(): ReactNode {
  return (
    <EmptyState
      icon={BellIcon}
      variant="compact"
      title={<Trans>You&apos;re all caught up</Trans>}
      body={
        <Trans>
          New notifications will show up here when someone reaches out.
        </Trans>
      }
    />
  );
}
