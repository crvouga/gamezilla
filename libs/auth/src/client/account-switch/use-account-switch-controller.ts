import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';

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
  const [isPending, setIsPending] = useState(false);
  const targetRef = useRef<AccountSwitchTarget | null>(null);
  const bootRef = useRef<SyncBootReport>(INITIAL_BOOT);
  const bootListenersRef = useRef(new Set<() => void>());
  const inFlightRef = useRef(false);

  const reportSyncBootPhase = useReportBootPhase(bootRef, bootListenersRef);
  const subscribeBoot = useSubscribeBoot(bootListenersRef);
  const finishSuccess = useFinishSuccess({
    targetRef,
    inFlightRef,
    setIsPending,
    setPhase,
    setError,
  });
  const executeSwitch = useExecuteSwitch({
    switchAccount,
    subscribeBoot,
    bootRef,
    targetRef,
    inFlightRef,
    setPhase,
    setError,
    setIsPending,
    finishSuccess,
  });
  const switchToAccount = useSwitchToAccount(
    executeSwitch,
    inFlightRef,
    isPending
  );
  const retry = useRetrySwitch(executeSwitch, targetRef, inFlightRef);
  const dismissError = useDismissError({
    targetRef,
    inFlightRef,
    setIsPending,
    setPhase,
    setError,
  });

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

function useFinishSuccess(args: {
  targetRef: MutableRefObject<AccountSwitchTarget | null>;
  inFlightRef: MutableRefObject<boolean>;
  setIsPending: (pending: boolean) => void;
  setPhase: (phase: AccountSwitchPhase) => void;
  setError: (error: Error | null) => void;
}) {
  const { targetRef, inFlightRef, setIsPending, setPhase, setError } = args;
  return useCallback(() => {
    const onComplete = targetRef.current?.onComplete;
    targetRef.current = null;
    inFlightRef.current = false;
    setIsPending(false);
    setPhase('idle');
    setError(null);
    onComplete?.();
  }, [targetRef, inFlightRef, setIsPending, setPhase, setError]);
}

function useSwitchToAccount(
  executeSwitch: (target: AccountSwitchTarget) => Promise<void>,
  inFlightRef: MutableRefObject<boolean>,
  isPending: boolean
) {
  return useCallback(
    async (target: AccountSwitchTarget) => {
      if (inFlightRef.current || isPending) return;
      await executeSwitch(target);
    },
    [executeSwitch, inFlightRef, isPending]
  );
}

function useRetrySwitch(
  executeSwitch: (target: AccountSwitchTarget) => Promise<void>,
  targetRef: MutableRefObject<AccountSwitchTarget | null>,
  inFlightRef: MutableRefObject<boolean>
) {
  return useCallback(() => {
    const target = targetRef.current;
    if (target === null || inFlightRef.current) return;
    void executeSwitch(target).catch(() => undefined);
  }, [executeSwitch, targetRef, inFlightRef]);
}

function useDismissError(args: {
  targetRef: MutableRefObject<AccountSwitchTarget | null>;
  inFlightRef: MutableRefObject<boolean>;
  setIsPending: (pending: boolean) => void;
  setPhase: (phase: AccountSwitchPhase) => void;
  setError: (error: Error | null) => void;
}) {
  const { targetRef, inFlightRef, setIsPending, setPhase, setError } = args;
  return useCallback(() => {
    targetRef.current = null;
    inFlightRef.current = false;
    setIsPending(false);
    setPhase('idle');
    setError(null);
  }, [targetRef, inFlightRef, setIsPending, setPhase, setError]);
}

function useReportBootPhase(
  bootRef: MutableRefObject<SyncBootReport>,
  listenersRef: MutableRefObject<Set<() => void>>
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

function useSubscribeBoot(listenersRef: MutableRefObject<Set<() => void>>) {
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

type ExecuteSwitchArgs = {
  switchAccount: ReturnType<typeof useSwitchAccount>;
  subscribeBoot: (onChange: () => void) => () => void;
  bootRef: MutableRefObject<SyncBootReport>;
  targetRef: MutableRefObject<AccountSwitchTarget | null>;
  inFlightRef: MutableRefObject<boolean>;
  setPhase: (phase: AccountSwitchPhase) => void;
  setError: (error: Error | null) => void;
  setIsPending: (pending: boolean) => void;
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
    setIsPending,
    finishSuccess,
  } = args;
  return useCallback(
    async (target: AccountSwitchTarget) => {
      targetRef.current = target;
      inFlightRef.current = true;
      setIsPending(true);
      setError(null);
      setPhase('idle');
      try {
        await runAccountSwitch(target, {
          switchAccount,
          readBoot: () => bootRef.current,
          subscribeBoot,
        });
        finishSuccess();
      } catch (caught) {
        inFlightRef.current = false;
        setIsPending(false);
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
      setIsPending,
      finishSuccess,
    ]
  );
}
