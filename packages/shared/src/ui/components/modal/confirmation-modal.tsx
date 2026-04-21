/**
 * `ConfirmationModal` -- ready-made confirm/cancel dialog.
 *
 * @example
 * ```tsx
 * <ConfirmationModal
 *   visible={show}
 *   title="Delete item?"
 *   message="This action cannot be undone."
 *   variant="destructive"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShow(false)}
 * />
 * ```
 */

import { ModalBackdrop } from './modal-backdrop';
import { ModalBody } from './modal-body';
import { ModalButton } from './modal-button';
import { ModalContent } from './modal-content';
import { ModalFooter } from './modal-footer';
import { ModalHeader } from './modal-header';
import { ModalRoot } from './modal-root';

export type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <ModalRoot visible={visible} onRequestClose={onCancel}>
      <ModalBackdrop onPress={onCancel}>
        <ModalContent>
          <ModalHeader title={title} />
          <ModalBody message={message} />
          <ModalFooter>
            <ModalButton
              label={cancelLabel}
              variant="cancel"
              onPress={onCancel}
            />
            <ModalButton
              label={confirmLabel}
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onPress={onConfirm}
            />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
