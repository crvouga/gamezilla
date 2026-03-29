import type { PropsWithChildren } from 'react';
import { Modal } from 'react-native';

type ModalRootProps = PropsWithChildren<{
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
    >
      {children}
    </Modal>
  );
}
