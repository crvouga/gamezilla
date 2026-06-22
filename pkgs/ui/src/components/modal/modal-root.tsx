/**
 * `ModalRoot` -- transparent modal wrapper.
 *
 * Resets the on-color context at the modal boundary so text opened from a
 * colored surface (e.g. a gradient card) does not inherit a white foreground
 * on the modal's neutral `surfaceOverlay` fill.
 */

import type { PropsWithChildren } from 'react';
import { Modal } from 'react-native';
import { OnColorReset } from '../../theme';

export type ModalRootProps = PropsWithChildren<{
  visible: boolean;
  onRequestClose: () => void;
}>;

export function ModalRoot({
  visible,
  onRequestClose,
  children,
}: ModalRootProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      accessibilityViewIsModal
    >
      <OnColorReset>{children}</OnColorReset>
    </Modal>
  );
}
