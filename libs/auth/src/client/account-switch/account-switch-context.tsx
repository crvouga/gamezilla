import { createContext, useContext } from 'react';

import type { SyncBootPhase } from './account-switch-boot-gate';

export type AccountSwitchTarget = {
  readonly sessionId: string;
  readonly accountId: string | null;
  /** Called after the target identity boot is ready. */
  readonly onComplete?: (() => void) | undefined;
};

export type AccountSwitchPhase = 'idle' | 'error';

export type AccountSwitchContextValue = {
  readonly phase: AccountSwitchPhase;
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly switchToAccount: (target: AccountSwitchTarget) => Promise<void>;
  readonly reportSyncBootPhase: (
    phase: SyncBootPhase,
    accountId: string | null
  ) => void;
  readonly retry: () => void;
  readonly dismissError: () => void;
};

export const AccountSwitchContext =
  createContext<AccountSwitchContextValue | null>(null);

function useAccountSwitchContext(): AccountSwitchContextValue {
  const value = useContext(AccountSwitchContext);
  if (value === null) {
    throw new Error(
      'AccountSwitchProvider is required — wrap the tree in AppAuthProvider'
    );
  }
  return value;
}

/** Controller used by the account menu to start a switch. */
export function useAccountSwitch(): Pick<
  AccountSwitchContextValue,
  'switchToAccount' | 'isPending' | 'phase'
> {
  const { switchToAccount, isPending, phase } = useAccountSwitchContext();
  return { switchToAccount, isPending, phase };
}

/** SyncEngineBoot reports readiness upward so switchToAccount can finish. */
export function useReportSyncBootPhase(): AccountSwitchContextValue['reportSyncBootPhase'] {
  return useAccountSwitchContext().reportSyncBootPhase;
}
