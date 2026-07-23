import type { ReactNode } from 'react';

import { AccountSwitchContext } from './account-switch-context';
import { AccountSwitchModal } from './account-switch-modal';
import { useAccountSwitchController } from './use-account-switch-controller';

/**
 * Shell-level account-switch overlay. Mounted above SyncEngineBoot so it
 * survives identity remounts and owns all loading/success chrome.
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
        visible={value.phase !== 'idle'}
        phase={value.phase}
        error={value.error}
        onRetry={value.retry}
        onDismissError={value.dismissError}
      />
    </AccountSwitchContext.Provider>
  );
}
