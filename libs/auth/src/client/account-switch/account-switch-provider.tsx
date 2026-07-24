import type { ReactNode } from 'react';

import { AccountSwitchContext } from './account-switch-context';
import { AccountSwitchModal } from './account-switch-modal';
import { useAccountSwitchController } from './use-account-switch-controller';

/**
 * Account-switch controller mounted above SyncEngineBoot. No loading/success
 * chrome — warm pooled engines make switches near-instant; only failures show
 * a retryable error modal.
 */
export function AccountSwitchProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const value = useAccountSwitchController();
  return (
    <AccountSwitchContext.Provider value={value}>
      {children}
      <AccountSwitchModal
        visible={value.phase === 'error'}
        error={value.error}
        onRetry={value.retry}
        onDismiss={value.dismissError}
      />
    </AccountSwitchContext.Provider>
  );
}
