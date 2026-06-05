import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useSpaceActions } from './space-actions';

export type SpaceLifecycleRequestOptions = {
  /** Runs after the user dismisses the success state (e.g. navigation). */
  onSuccess?: () => void;
};

// Internal discriminators — not user-facing copy.
/* eslint-disable lingui/no-unlocalized-strings -- pending action kind tags */
const PENDING_KIND = {
  end: 'end',
  leave: 'leave',
} as const;
/* eslint-enable lingui/no-unlocalized-strings */

type PendingEnd = {
  kind: typeof PENDING_KIND.end;
  spaceId: string;
  onSuccess?: () => void;
};

type PendingLeave = {
  kind: typeof PENDING_KIND.leave;
  spaceId: string;
  onSuccess?: () => void;
};

type PendingAction = PendingEnd | PendingLeave | null;

export type SpaceLifecycleModals = {
  requestEndSpace: (
    spaceId: string,
    options?: SpaceLifecycleRequestOptions
  ) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: SpaceLifecycleRequestOptions
  ) => void;
};

const Ctx = createContext<SpaceLifecycleModals | null>(null);

function pendingFromRequest(
  kind: PendingEnd['kind'] | PendingLeave['kind'],
  spaceId: string,
  options?: SpaceLifecycleRequestOptions
): PendingAction {
  const onSuccess = options?.onSuccess;
  if (onSuccess === undefined) {
    return { kind, spaceId };
  }
  return { kind, spaceId, onSuccess };
}

/**
 * Owns end/leave confirm modals at app scope so they stay mounted through
 * loading → success even when the space drops out of the user's active list.
 */
export function SpaceLifecycleModalProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [pending, setPending] = useState<PendingAction>(null);

  const requestEndSpace = useCallback(
    (spaceId: string, options?: SpaceLifecycleRequestOptions) => {
      setPending(pendingFromRequest(PENDING_KIND.end, spaceId, options));
    },
    []
  );

  const requestLeaveSpace = useCallback(
    (spaceId: string, options?: SpaceLifecycleRequestOptions) => {
      setPending(pendingFromRequest(PENDING_KIND.leave, spaceId, options));
    },
    []
  );

  const onClose = useCallback(() => setPending(null), []);

  const value = useMemo<SpaceLifecycleModals>(
    () => ({ requestEndSpace, requestLeaveSpace }),
    [requestEndSpace, requestLeaveSpace]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <EndSpaceLifecycleModal pending={pending} onClose={onClose} />
      <LeaveSpaceLifecycleModal pending={pending} onClose={onClose} />
    </Ctx.Provider>
  );
}

function EndSpaceLifecycleModal({
  pending,
  onClose,
}: {
  pending: PendingAction;
  onClose: () => void;
}): ReactNode {
  const { endSpace } = useSpaceActions();
  const active = pending?.kind === PENDING_KIND.end ? pending : null;
  const spaceId = active?.spaceId ?? '';
  const operation = useCallback(() => endSpace(spaceId), [endSpace, spaceId]);

  return (
    <EndSpaceConfirmModal
      visible={active !== null}
      onClose={onClose}
      operation={operation}
      {...(active?.onSuccess !== undefined
        ? { onSuccess: active.onSuccess }
        : {})}
    />
  );
}

function LeaveSpaceLifecycleModal({
  pending,
  onClose,
}: {
  pending: PendingAction;
  onClose: () => void;
}): ReactNode {
  const { leaveSpace } = useSpaceActions();
  const active = pending?.kind === PENDING_KIND.leave ? pending : null;
  const spaceId = active?.spaceId ?? '';
  const operation = useCallback(
    () => leaveSpace(spaceId),
    [leaveSpace, spaceId]
  );

  return (
    <LeaveSpaceConfirmModal
      visible={active !== null}
      onClose={onClose}
      operation={operation}
      {...(active?.onSuccess !== undefined
        ? { onSuccess: active.onSuccess }
        : {})}
    />
  );
}

export function useSpaceLifecycleModals(): SpaceLifecycleModals {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useSpaceLifecycleModals: SpaceLifecycleModalProvider missing — wrap with AppProviders'
    );
  }
  return v;
}
