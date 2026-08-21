// @io-wall-ok — real `@gorhom/bottom-sheet` host for wall ClientEnv / sim console.

import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type {
  BottomSheetHost,
  BottomSheetHostBackdropProps,
  BottomSheetHostModalProps,
  BottomSheetHostViewProps,
  BottomSheetModalMethods,
} from '@pkgs/ui';
import type { ReactElement } from 'react';
import { createElement, forwardRef } from 'react';

const GorhomModal = forwardRef<
  BottomSheetModalMethods,
  BottomSheetHostModalProps
>(function GorhomModal(props, ref) {
  return createElement(BottomSheetModal, {
    ...(props as object),
    ref,
  } as never);
});

function GorhomBackdrop(props: BottomSheetHostBackdropProps): ReactElement {
  return createElement(BottomSheetBackdrop, props as never);
}

function GorhomView(props: BottomSheetHostViewProps): ReactElement {
  const { children, style, ...rest } = props;
  return createElement(
    BottomSheetView,
    { style, ...(rest as object) } as never,
    children
  );
}

/** Singleton wall host — safe to share across product + sim console roots. */
export const wallBottomSheetHost: BottomSheetHost = {
  Provider: BottomSheetModalProvider,
  Modal: GorhomModal,
  View: GorhomView,
  Backdrop: GorhomBackdrop,
  supportsSheetPresentation: true,
};
