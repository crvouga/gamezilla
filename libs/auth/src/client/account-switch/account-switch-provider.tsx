import type { ReactNode } from 'react';

import { AccountSwitchContext } from './account-switch-context';
import { useAccountSwitchController } from './use-account-switch-controller';

/**
 * Account-switch controller mounted above SyncEngineBoot so boot readiness can
 * report upward. Mount {@link AccountSwitchSurface} under AppUiPortals — it
 * needs SurfaceStackProvider for ModalRoot.
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
    </AccountSwitchContext.Provider>
  );
}
