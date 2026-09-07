import { createContext, createSignal, type JSX, useContext } from 'solid-js';

import { useCurrentSpaceRole } from '../use-current-space-role';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useLeaveSpace } from './use-leave-space';

export type RequestLeaveSpaceOptions = {
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
};

type PendingLeave = {
  spaceId: string;
  onSuccess?: (() => void) | undefined;
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
export function LeaveSpaceModalProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [pending, setPending] = createSignal<PendingLeave | null>(null);
  const leaveSpace = useLeaveSpace();
  const spaceId = () => pending()?.spaceId ?? '';
  const role = useCurrentSpaceRole(spaceId);

  const requestLeaveSpace = (
    nextSpaceId: string,
    options?: RequestLeaveSpaceOptions
  ): void => {
    const onSuccess = options?.onSuccess;
    setPending(() =>
      onSuccess === undefined
        ? { spaceId: nextSpaceId }
        : { spaceId: nextSpaceId, onSuccess }
    );
  };

  const modals: LeaveSpaceModals = { requestLeaveSpace };

  return (
    <Ctx.Provider value={modals}>
      {props.children}
      <LeaveSpaceConfirmModal
        visible={pending() !== null}
        onClose={() => setPending(() => null)}
        operation={() => leaveSpace(spaceId())}
        asHost={role() === 'host'}
        onSuccess={() => pending()?.onSuccess?.()}
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
