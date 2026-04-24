/**
 * `ConfirmationModal` -- ready-made confirm/cancel dialog.
 *
 * Uses {@link ResponsiveSurface}: bottom sheet on mobile, centered modal on
 * larger breakpoints.
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

import { useRef } from 'react';
import { ResponsiveSurface } from '../responsive-surface';
import { ModalBody } from './modal-body';
import { ModalButton } from './modal-button';
import { ModalFooter } from './modal-footer';

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

type LatchedContent = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'destructive';
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
  // Keep last-seen content rendered while the modal animates closed so callers
  // can null out their source state on confirm/cancel without producing a
  // flash of empty content during the fade-out.
  const latchedRef = useRef<LatchedContent>({
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant,
  });
  if (visible) {
    latchedRef.current = {
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
    };
  }
  const display = visible
    ? { title, message, confirmLabel, cancelLabel, variant }
    : latchedRef.current;

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onCancel}
      title={display.title}
    >
      <ModalBody message={display.message} />
      <ModalFooter>
        <ModalButton
          label={display.cancelLabel}
          variant="cancel"
          onPress={onCancel}
        />
        <ModalButton
          label={display.confirmLabel}
          variant={
            display.variant === 'destructive' ? 'destructive' : 'default'
          }
          onPress={onConfirm}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
