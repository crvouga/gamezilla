/**
 * `ModalRoot` -- transparent modal wrapper.
 *
 * Resets the on-color context at the modal boundary so text opened from a
 * colored surface (e.g. a gradient card) does not inherit a white foreground
 * on the modal's neutral `surfaceOverlay` fill.
 *
 * On web, {@link FocusTrap} keeps Tab focus inside the modal, restores it on
 * close, and dismisses on Escape via `onRequestClose`. Native relies on
 * `accessibilityViewIsModal` and the system back button.
 */

import type { PropsWithChildren } from 'react';
import { Modal } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { FocusTrap } from '../focus-trap';
import { OnColorReset } from '../../theme';

export type ModalRootProps = PropsWithChildren<{
  visible: boolean;
  onRequestClose: () => void;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ModalRoot({
  visible,
  onRequestClose,
  children,
  dataSet,
}: ModalRootProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      accessibilityViewIsModal
      {...componentDataSet('ModalRoot', dataSet)}
    >
      <OnColorReset>
        <FocusTrap active={visible} onEscape={onRequestClose}>
          {children}
        </FocusTrap>
      </OnColorReset>
    </Modal>
  );
}
