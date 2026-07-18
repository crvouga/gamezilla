import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { LeaveSpaceEverywhereConfirmModal } from './leave-space-everywhere-confirm-modal';
import { useLeaveSpace } from './use-leave-space';
import { useLeaveSpaceEverywhere } from './use-leave-space-everywhere';

export type RequestLeaveSpaceOptions = {
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
};

type PendingLeave = {
  spaceId: string;
  onSuccess?: () => void;
};

export type LeaveSpaceModals = {
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
  requestLeaveSpaceEverywhere: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

const Ctx = createContext<LeaveSpaceModals | null>(null);

/**
 * Owns leave-space confirm modals at app scope so they stay mounted through
 * loading → success even when the space drops out of the user's active list.
 */
export function LeaveSpaceModalProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const [pendingEverywhere, setPendingEverywhere] =
    useState<PendingLeave | null>(null);
  const leaveSpace = useLeaveSpace();
  const leaveEverywhere = useLeaveSpaceEverywhere();

  const requestLeaveSpace = useCallback(
    (spaceId: string, options?: RequestLeaveSpaceOptions) => {
      const onSuccess = options?.onSuccess;
      setPending(
        onSuccess === undefined ? { spaceId } : { spaceId, onSuccess }
      );
    },
    []
  );

  const requestLeaveSpaceEverywhere = useCallback(
    (spaceId: string, options?: RequestLeaveSpaceOptions) => {
      const onSuccess = options?.onSuccess;
      setPendingEverywhere(
        onSuccess === undefined ? { spaceId } : { spaceId, onSuccess }
      );
    },
    []
  );

  const onClose = useCallback(() => setPending(null), []);
  const onCloseEverywhere = useCallback(() => setPendingEverywhere(null), []);
  const spaceId = pending?.spaceId ?? '';
  const everywhereSpaceId = pendingEverywhere?.spaceId ?? '';
  const operation = useCallback(
    () => leaveSpace(spaceId),
    [leaveSpace, spaceId]
  );
  const everywhereOperation = useCallback(
    () => leaveEverywhere(everywhereSpaceId),
    [leaveEverywhere, everywhereSpaceId]
  );
  const value = useMemo(
    () => ({ requestLeaveSpace, requestLeaveSpaceEverywhere }),
    [requestLeaveSpace, requestLeaveSpaceEverywhere]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <LeaveSpaceConfirmModal
        visible={pending !== null}
        onClose={onClose}
        operation={operation}
        {...(pending?.onSuccess !== undefined
          ? { onSuccess: pending.onSuccess }
          : {})}
      />
      <LeaveSpaceEverywhereConfirmModal
        visible={pendingEverywhere !== null}
        onClose={onCloseEverywhere}
        operation={everywhereOperation}
        {...(pendingEverywhere?.onSuccess !== undefined
          ? { onSuccess: pendingEverywhere.onSuccess }
          : {})}
      />
    </Ctx.Provider>
  );
}

export function useRequestLeaveSpace(): LeaveSpaceModals['requestLeaveSpace'] {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useRequestLeaveSpace: LeaveSpaceModalProvider missing — wrap with AppProviders'
    );
  }
  return v.requestLeaveSpace;
}

export function useRequestLeaveSpaceEverywhere(): LeaveSpaceModals['requestLeaveSpaceEverywhere'] {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useRequestLeaveSpaceEverywhere: LeaveSpaceModalProvider missing — wrap with AppProviders'
    );
  }
  return v.requestLeaveSpaceEverywhere;
}
