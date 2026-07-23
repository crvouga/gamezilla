import { createContext, useContext } from 'react';

import type { SyncBootPhase } from './account-switch-boot-gate';

export type AccountSwitchTarget = {
  readonly sessionId: string;
  readonly accountId: string | null;
  /** Called after success hold, just before the overlay dismisses. */
  readonly onComplete?: (() => void) | undefined;
};

export type AccountSwitchPhase = 'idle' | 'loading' | 'success' | 'error';

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

/** True while the switch overlay owns loading/success (boot should blank). */
export function useIsAccountSwitchPending(): boolean {
  return useAccountSwitchContext().isPending;
}

/** SyncEngineBoot reports readiness upward so the overlay can finish. */
export function useReportSyncBootPhase(): AccountSwitchContextValue['reportSyncBootPhase'] {
  return useAccountSwitchContext().reportSyncBootPhase;
}
