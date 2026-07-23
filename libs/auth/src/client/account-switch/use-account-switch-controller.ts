import { useCallback, useMemo, useRef, useState } from 'react';

import { useSwitchAccount } from '../use-switch-account';
import type { SyncBootPhase, SyncBootReport } from './account-switch-boot-gate';
import type {
  AccountSwitchContextValue,
  AccountSwitchPhase,
  AccountSwitchTarget,
} from './account-switch-context';
import { runAccountSwitch } from './account-switch-run';

const INITIAL_BOOT: SyncBootReport = { phase: 'loading', accountId: null };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Owns switch lifecycle state for {@link AccountSwitchProvider}. */
export function useAccountSwitchController(): AccountSwitchContextValue {
  const switchAccount = useSwitchAccount();
  const [phase, setPhase] = useState<AccountSwitchPhase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const targetRef = useRef<AccountSwitchTarget | null>(null);
  const bootRef = useRef<SyncBootReport>(INITIAL_BOOT);
  const bootListenersRef = useRef(new Set<() => void>());
  const inFlightRef = useRef(false);

  const reportSyncBootPhase = useReportBootPhase(bootRef, bootListenersRef);
  const subscribeBoot = useSubscribeBoot(bootListenersRef);
  const finishSuccess = useFinishSuccess(
    targetRef,
    inFlightRef,
    setPhase,
    setError
  );
  const executeSwitch = useExecuteSwitch({
    switchAccount,
    subscribeBoot,
    bootRef,
    targetRef,
    inFlightRef,
    setPhase,
    setError,
    finishSuccess,
  });

  const switchToAccount = useCallback(
    async (target: AccountSwitchTarget) => {
      if (inFlightRef.current || phase === 'loading' || phase === 'success') {
        return;
      }
      await executeSwitch(target);
    },
    [executeSwitch, phase]
  );

  const retry = useCallback(() => {
    const target = targetRef.current;
    if (target === null || inFlightRef.current) return;
    void executeSwitch(target).catch(() => undefined);
  }, [executeSwitch]);

  const dismissError = useCallback(() => {
    targetRef.current = null;
    inFlightRef.current = false;
    setPhase('idle');
    setError(null);
  }, []);

  const isPending = phase === 'loading' || phase === 'success';
  return useMemo(
    () => ({
      phase,
      error,
      isPending,
      switchToAccount,
      reportSyncBootPhase,
      retry,
      dismissError,
    }),
    [
      phase,
      error,
      isPending,
      switchToAccount,
      reportSyncBootPhase,
      retry,
      dismissError,
    ]
  );
}

function useReportBootPhase(
  bootRef: React.MutableRefObject<SyncBootReport>,
  listenersRef: React.MutableRefObject<Set<() => void>>
) {
  return useCallback(
    (nextPhase: SyncBootPhase, accountId: string | null) => {
      bootRef.current = { phase: nextPhase, accountId };
      for (const listener of listenersRef.current) {
        listener();
      }
    },
    [bootRef, listenersRef]
  );
}

function useSubscribeBoot(
  listenersRef: React.MutableRefObject<Set<() => void>>
) {
  return useCallback(
    (onChange: () => void) => {
      listenersRef.current.add(onChange);
      return () => {
        listenersRef.current.delete(onChange);
      };
    },
    [listenersRef]
  );
}

function useFinishSuccess(
  targetRef: React.MutableRefObject<AccountSwitchTarget | null>,
  inFlightRef: React.MutableRefObject<boolean>,
  setPhase: (phase: AccountSwitchPhase) => void,
  setError: (error: Error | null) => void
) {
  return useCallback(() => {
    const onComplete = targetRef.current?.onComplete;
    targetRef.current = null;
    inFlightRef.current = false;
    setPhase('idle');
    setError(null);
    onComplete?.();
  }, [targetRef, inFlightRef, setPhase, setError]);
}

type ExecuteSwitchArgs = {
  switchAccount: ReturnType<typeof useSwitchAccount>;
  subscribeBoot: (onChange: () => void) => () => void;
  bootRef: React.MutableRefObject<SyncBootReport>;
  targetRef: React.MutableRefObject<AccountSwitchTarget | null>;
  inFlightRef: React.MutableRefObject<boolean>;
  setPhase: (phase: AccountSwitchPhase) => void;
  setError: (error: Error | null) => void;
  finishSuccess: () => void;
};

function useExecuteSwitch(args: ExecuteSwitchArgs) {
  const {
    switchAccount,
    subscribeBoot,
    bootRef,
    targetRef,
    inFlightRef,
    setPhase,
    setError,
    finishSuccess,
  } = args;
  return useCallback(
    async (target: AccountSwitchTarget) => {
      targetRef.current = target;
      inFlightRef.current = true;
      setError(null);
      setPhase('loading');
      try {
        await runAccountSwitch(target, {
          switchAccount,
          readBoot: () => bootRef.current,
          subscribeBoot,
          onPhase: setPhase,
        });
        finishSuccess();
      } catch (caught) {
        inFlightRef.current = false;
        setError(toError(caught));
        setPhase('error');
        throw caught;
      }
    },
    [
      switchAccount,
      subscribeBoot,
      bootRef,
      targetRef,
      inFlightRef,
      setPhase,
      setError,
      finishSuccess,
    ]
  );
}
