import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { useEndSpace } from './use-end-space';

export type RequestEndSpaceOptions = {
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
};

type PendingEnd = {
  spaceId: string;
  onSuccess?: () => void;
};

export type EndSpaceModals = {
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
};

const Ctx = createContext<EndSpaceModals | null>(null);

/**
 * Owns the end-space confirm modal at app scope so it stays mounted through
 * loading → success even when the space drops out of the user's active list.
 */
export function EndSpaceModalProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [pending, setPending] = useState<PendingEnd | null>(null);
  const endSpace = useEndSpace();

  const requestEndSpace = useCallback(
    (spaceId: string, options?: RequestEndSpaceOptions) => {
      const onSuccess = options?.onSuccess;
      setPending(
        onSuccess === undefined ? { spaceId } : { spaceId, onSuccess }
      );
    },
    []
  );

  const onClose = useCallback(() => setPending(null), []);
  const spaceId = pending?.spaceId ?? '';
  const operation = useCallback(() => endSpace(spaceId), [endSpace, spaceId]);
  const value = useMemo(() => ({ requestEndSpace }), [requestEndSpace]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <EndSpaceConfirmModal
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

export function useRequestEndSpace(): EndSpaceModals['requestEndSpace'] {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useRequestEndSpace: EndSpaceModalProvider missing — wrap with AppProviders'
    );
  }
  return v.requestEndSpace;
}
