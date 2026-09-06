/**
 * Sim / DST bottom-sheet host: present/dismiss gate children (mirrors gorhom
 * mount lifecycle) so closed sheets do not flood the React tree.
 */

import {
  forwardRef,
  type ReactElement,
  type ReactNode,
  useImperativeHandle,
  useState,
} from 'react';

import type {
  BottomSheetHost,
  BottomSheetHostBackdropProps,
  BottomSheetHostModalProps,
  BottomSheetHostViewProps,
  BottomSheetModalMethods,
} from './types';

function Passthrough({ children }: { children?: ReactNode }): ReactElement {
  return <>{children ?? null}</>;
}

const PassthroughModal = forwardRef<
  BottomSheetModalMethods,
  BottomSheetHostModalProps
>(function PassthroughModal(props, ref) {
  const [presented, setPresented] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setPresented(true);
      },
      dismiss: () => {
        setPresented(false);
        props.onDismiss?.();
      },
    }),
    [props.onDismiss]
  );
  if (!presented) return null;
  return <Passthrough>{props.children}</Passthrough>;
});

function PassthroughBackdrop(
  _props: BottomSheetHostBackdropProps
): ReactElement | null {
  return null;
}

function PassthroughView(props: BottomSheetHostViewProps): ReactElement {
  return <Passthrough>{props.children}</Passthrough>;
}

/** Runtime for sim ClientEnv and any tree that must not load `@gorhom/bottom-sheet`. */
export function createPassthroughBottomSheetHost(): BottomSheetHost {
  return {
    Provider: Passthrough,
    Modal: PassthroughModal,
    View: PassthroughView,
    Backdrop: PassthroughBackdrop,
    supportsSheetPresentation: false,
  };
}
