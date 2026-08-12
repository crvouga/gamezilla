/**
 * `ModalBackdrop` -- semi-transparent overlay that dismisses on tap.
 *
 * Uses the active `scrim` token so light and dark schemes both get a
 * scene-appropriate backdrop (light mode: cool zinc dim; dark: deeper
 * near-black). Content area is centered and pointer-passthrough so taps
 * outside the modal hit the backdrop.
 *
 * Relies on a sized ancestor (e.g. {@link FocusTrap} / RN `Modal` with
 * `flex: 1`) so this fill expands to the viewport.
 */

import type { PropsWithChildren } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Pressable } from '../pressable';

export type ModalBackdropProps = PropsWithChildren<{
  onPress: () => void;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ModalBackdrop({
  onPress,
  children,
  dataSet,
}: ModalBackdropProps) {
  return (
    <Box sx={{ flex: 1 }} dataSet={{ component: 'ModalBackdrop', ...dataSet }}>
      <Pressable
        onPress={onPress}
        sx={{ absoluteFill: true, backgroundColor: 'scrim' }}
        feedback="none"
      />
      {/*
        pointerEvents must be a View prop — style.pointerEvents is ignored on
        RN Web, so the flex:1 centering layer would eat backdrop presses.
      */}
      <Box
        pointerEvents="box-none"
        sx={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Box pointerEvents="auto">{children}</Box>
      </Box>
    </Box>
  );
}
