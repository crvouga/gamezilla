import { createContext, useContext } from 'react';

import type { SyncBootPhase } from './account-switch-boot-gate';

export type AccountSwitchTarget = {
  readonly sessionId: string;
  readonly accountId: string | null;
  /** Shown on the transition surface while loading / success. */
  readonly displayTitle?: string | undefined;
  /** Called after the target identity boot is ready (as success phase begins). */
  readonly onComplete?: (() => void) | undefined;
};

export type AccountSwitchPhase = 'idle' | 'loading' | 'success' | 'error';

export type AccountSwitchContextValue = {
  readonly phase: AccountSwitchPhase;
  readonly error: Error | null;
  readonly isPending: boolean;
  /** Display title captured when the switch started. */
  readonly pendingDisplayTitle: string | null;
  readonly switchToAccount: (target: AccountSwitchTarget) => Promise<void>;
  readonly reportSyncBootPhase: (
    phase: SyncBootPhase,
    accountId: string | null
  ) => void;
  readonly retry: () => void;
  readonly dismissError: () => void;
  /** Dismiss success chrome (or cancel after error). */
  readonly dismiss: () => void;
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

/** Controller used by the account switcher to start a switch. */
export function useAccountSwitch(): Pick<
  AccountSwitchContextValue,
  'switchToAccount' | 'isPending' | 'phase' | 'pendingDisplayTitle'
> {
  const { switchToAccount, isPending, phase, pendingDisplayTitle } =
    useAccountSwitchContext();
  return { switchToAccount, isPending, phase, pendingDisplayTitle };
}

/** SyncEngineBoot reports readiness upward so switchToAccount can finish. */
export function useReportSyncBootPhase(): AccountSwitchContextValue['reportSyncBootPhase'] {
  return useAccountSwitchContext().reportSyncBootPhase;
}

/** Full controller surface for the transition modal. */
export function useAccountSwitchSurface(): Pick<
  AccountSwitchContextValue,
  | 'phase'
  | 'error'
  | 'pendingDisplayTitle'
  | 'retry'
  | 'dismissError'
  | 'dismiss'
> {
  const { phase, error, pendingDisplayTitle, retry, dismissError, dismiss } =
    useAccountSwitchContext();
  return { phase, error, pendingDisplayTitle, retry, dismissError, dismiss };
}
