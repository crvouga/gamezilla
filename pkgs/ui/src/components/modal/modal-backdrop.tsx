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
import { MODAL_CONTENT_MARGIN_STEP } from '../../theme/modal-size';
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
    <Box
      sx={{ flex: 1, width: '100%', height: '100%' }}
      dataSet={{ component: 'ModalBackdrop', ...dataSet }}
    >
      <Pressable
        onPress={onPress}
        sx={{ absoluteFill: true, backgroundColor: 'scrim' }}
        feedback="none"
      />
      {/*
        pointerEvents is compiled onto style by Box (RN Web deprecates the
        View prop). box-none lets backdrop presses pass through the centering
        layer.
      */}
      <Box
        pointerEvents="box-none"
        sx={{
          flex: 1,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          p: MODAL_CONTENT_MARGIN_STEP,
        }}
      >
        <Box pointerEvents="auto" sx={{ width: '100%', maxWidth: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
