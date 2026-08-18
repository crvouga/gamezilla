import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useCurrentSpaceRole } from '../use-current-space-role';
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
 * Owns leave-space confirm modals at app scope so they stay mounted through
 * loading → success even when the space drops out of the user's active list.
 * Host leave ends the space (I4) — confirm copy matches End when still host.
 */
export function LeaveSpaceModalProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const leaveSpace = useLeaveSpace();
  const spaceId = pending?.spaceId ?? '';
  const role = useCurrentSpaceRole(spaceId);
  const asHost = role === 'host';

  const requestLeaveSpace = useCallback(
    (nextSpaceId: string, options?: RequestLeaveSpaceOptions) => {
      const onSuccess = options?.onSuccess;
      setPending(
        onSuccess === undefined
          ? { spaceId: nextSpaceId }
          : { spaceId: nextSpaceId, onSuccess }
      );
    },
    []
  );

  const onClose = useCallback(() => setPending(null), []);
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
        asHost={asHost}
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
