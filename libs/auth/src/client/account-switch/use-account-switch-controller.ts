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

type SwitchControllerState = {
  phase: AccountSwitchPhase;
  error: Error | null;
  isPending: boolean;
  pendingDisplayTitle: string | null;
  targetRef: MutableRefObject<AccountSwitchTarget | null>;
  bootRef: MutableRefObject<SyncBootReport>;
  bootListenersRef: MutableRefObject<Set<() => void>>;
  inFlightRef: MutableRefObject<boolean>;
  setPhase: (phase: AccountSwitchPhase) => void;
  setError: (error: Error | null) => void;
  setIsPending: (pending: boolean) => void;
  setPendingDisplayTitle: (title: string | null) => void;
};

function useSwitchControllerState(): SwitchControllerState {
  const [phase, setPhase] = useState<AccountSwitchPhase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingDisplayTitle, setPendingDisplayTitle] = useState<string | null>(
    null
  );
  const targetRef = useRef<AccountSwitchTarget | null>(null);
  const bootRef = useRef<SyncBootReport>(INITIAL_BOOT);
  const bootListenersRef = useRef(new Set<() => void>());
  const inFlightRef = useRef(false);
  return {
    phase,
    error,
    isPending,
    pendingDisplayTitle,
    targetRef,
    bootRef,
    bootListenersRef,
    inFlightRef,
    setPhase,
    setError,
    setIsPending,
    setPendingDisplayTitle,
  };
}

/** Owns switch lifecycle state for {@link AccountSwitchProvider}. */
export function useAccountSwitchController(): AccountSwitchContextValue {
  const switchAccount = useSwitchAccount();
  const state = useSwitchControllerState();
  const reportSyncBootPhase = useReportBootPhase(
    state.bootRef,
    state.bootListenersRef
  );
  const subscribeBoot = useSubscribeBoot(state.bootListenersRef);
  const clearToIdle = useClearToIdle(state);
  const finishSuccess = useFinishSuccess(state);
  const executeSwitch = useExecuteSwitch({
    switchAccount,
    subscribeBoot,
    state,
    finishSuccess,
  });
  const switchToAccount = useSwitchToAccount(
    executeSwitch,
    state.inFlightRef,
    state.isPending
  );
  const retry = useRetrySwitch(
    executeSwitch,
    state.targetRef,
    state.inFlightRef
  );

  return useMemo(
    () => ({
      phase: state.phase,
      error: state.error,
      isPending: state.isPending,
      pendingDisplayTitle: state.pendingDisplayTitle,
      switchToAccount,
      reportSyncBootPhase,
      retry,
      dismissError: clearToIdle,
      dismiss: clearToIdle,
    }),
    [
      state.phase,
      state.error,
      state.isPending,
      state.pendingDisplayTitle,
      switchToAccount,
      reportSyncBootPhase,
      retry,
      clearToIdle,
    ]
  );
}

function useClearToIdle(state: SwitchControllerState) {
  const {
    targetRef,
    inFlightRef,
    setIsPending,
    setPhase,
    setError,
    setPendingDisplayTitle,
  } = state;
  return useCallback(() => {
    targetRef.current = null;
    inFlightRef.current = false;
    setIsPending(false);
    setPhase('idle');
    setError(null);
    setPendingDisplayTitle(null);
  }, [
    targetRef,
    inFlightRef,
    setIsPending,
    setPhase,
    setError,
    setPendingDisplayTitle,
  ]);
}

function useFinishSuccess(state: SwitchControllerState) {
  const { targetRef, inFlightRef, setIsPending, setPhase, setError } = state;
  return useCallback(() => {
    const onComplete = targetRef.current?.onComplete;
    inFlightRef.current = false;
    setIsPending(false);
    setError(null);
    setPhase('success');
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
  state: SwitchControllerState;
  finishSuccess: () => void;
};

function useExecuteSwitch(args: ExecuteSwitchArgs) {
  const { switchAccount, subscribeBoot, state, finishSuccess } = args;
  const {
    bootRef,
    targetRef,
    inFlightRef,
    setPhase,
    setError,
    setIsPending,
    setPendingDisplayTitle,
  } = state;
  return useCallback(
    async (target: AccountSwitchTarget) => {
      targetRef.current = target;
      inFlightRef.current = true;
      setIsPending(true);
      setError(null);
      setPendingDisplayTitle(target.displayTitle ?? null);
      setPhase('loading');
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
      setPendingDisplayTitle,
      finishSuccess,
    ]
  );
}
