import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useLeaveSpace } from './use-leave-space';

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
};

const Ctx = createContext<LeaveSpaceModals | null>(null);

/**
 * Owns the leave-space confirm modal at app scope so it stays mounted through
 * loading → success even when the space drops out of the user's active list.
 */
export function LeaveSpaceModalProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const leaveSpace = useLeaveSpace();

  const requestLeaveSpace = useCallback(
    (spaceId: string, options?: RequestLeaveSpaceOptions) => {
      const onSuccess = options?.onSuccess;
      setPending(
        onSuccess === undefined ? { spaceId } : { spaceId, onSuccess }
      );
    },
    []
  );

  const onClose = useCallback(() => setPending(null), []);
  const spaceId = pending?.spaceId ?? '';
  const operation = useCallback(
    () => leaveSpace(spaceId),
    [leaveSpace, spaceId]
  );
  const value = useMemo(() => ({ requestLeaveSpace }), [requestLeaveSpace]);

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
