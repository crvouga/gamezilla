import { createContext, createSignal, type JSX, useContext } from 'solid-js';

import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { useEndSpace } from './use-end-space';

export type RequestEndSpaceOptions = {
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
};

type PendingEnd = {
  spaceId: string;
  onSuccess?: (() => void) | undefined;
};

export type EndSpaceModals = {
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
};

const Ctx = createContext<EndSpaceModals | null>(null);

/**
 * Owns the end-space confirm modal at app scope so it stays mounted through
 * loading → success even when the space drops out of the user's active list.
 */
export function EndSpaceModalProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [pending, setPending] = createSignal<PendingEnd | null>(null);
  const endSpace = useEndSpace();

  const requestEndSpace = (
    spaceId: string,
    options?: RequestEndSpaceOptions
  ): void => {
    const onSuccess = options?.onSuccess;
    setPending(() =>
      onSuccess === undefined ? { spaceId } : { spaceId, onSuccess }
    );
  };

  const modals: EndSpaceModals = { requestEndSpace };

  return (
    <Ctx.Provider value={modals}>
      {props.children}
      <EndSpaceConfirmModal
        visible={pending() !== null}
        onClose={() => setPending(() => null)}
        operation={() => endSpace(pending()?.spaceId ?? '')}
        onSuccess={() => pending()?.onSuccess?.()}
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
