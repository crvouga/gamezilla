/**
 * `ModalRoot` -- transparent modal wrapper.
 *
 * Resets the on-color context at the modal boundary so text opened from a
 * colored surface (e.g. a gradient card) does not inherit a white foreground
 * on the modal's neutral `surfaceOverlay` fill.
 *
 * Renders into {@link SurfaceStackProvider} with a monotonic z-index so nested
 * surfaces stack by open order (same path on web and native).
 *
 * On web, {@link FocusTrap} keeps Tab focus inside the topmost modal, restores
 * it on close, and dismisses on Escape via `onRequestClose`. On native,
 * hardware back dismisses the topmost surface via {@link useModalBackDismiss}.
 */

import {
  useId,
  useMemo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { FocusTrap } from '../focus-trap';
import { usePortalContentWrap } from '../portal-content-bridge';
import {
  useIsTopSurface,
  useSurfaceStackSlot,
} from '../surface-stack';
import { OnColorReset } from '../../theme';
import { useModalBackDismiss } from './use-modal-back-dismiss';
import { useModalPresence } from './use-modal-presence';

export type ModalRootProps = PropsWithChildren<{
  visible: boolean;
  onRequestClose: () => void;
  /**
   * Stable surface-stack id. Prefer a constant for surfaces that remount
   * (e.g. live-spaces list) so they restore under overlays instead of
   * stealing the top slot. Defaults to a React `useId()`.
   */
  stackId?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

type ModalLayerProps = PropsWithChildren<{
  surfaceId: string;
  visible: boolean;
  opacity: Animated.Value;
  onRequestClose: () => void;
  dataSet?: ComponentDataSet;
}>;

function ModalLayer({
  surfaceId,
  visible,
  opacity,
  onRequestClose,
  children,
  dataSet,
}: ModalLayerProps): ReactNode {
  const isTop = useIsTopSurface(surfaceId);
  return (
    <Animated.View
      accessibilityViewIsModal
      style={[styles.layer, { opacity }]}
      {...componentDataSet('ModalRoot', dataSet)}
    >
      <OnColorReset>
        <FocusTrap active={visible && isTop} onEscape={onRequestClose}>
          {children}
        </FocusTrap>
      </OnColorReset>
    </Animated.View>
  );
}

export function ModalRoot({
  visible,
  onRequestClose,
  children,
  stackId,
  dataSet,
}: ModalRootProps): ReactNode {
  const generatedId = useId();
  const surfaceId = stackId ?? generatedId;
  const wrapPortalContent = usePortalContentWrap();
  const { mounted, opacity } = useModalPresence(visible);

  const chrome = useMemo(
    () =>
      wrapPortalContent(
        <ModalLayer
          surfaceId={surfaceId}
          visible={visible}
          opacity={opacity}
          onRequestClose={onRequestClose}
          {...(dataSet !== undefined ? { dataSet } : {})}
        >
          {children}
        </ModalLayer>
      ),
    [
      children,
      dataSet,
      onRequestClose,
      opacity,
      surfaceId,
      visible,
      wrapPortalContent,
    ]
  );

  const { isTop } = useSurfaceStackSlot(surfaceId, chrome, mounted);
  useModalBackDismiss(visible && isTop, onRequestClose);

  return null;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
});
