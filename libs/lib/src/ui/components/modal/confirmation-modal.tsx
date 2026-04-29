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

import { useLingui } from '@lingui/react/macro';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { ResponsiveSurface } from '../responsive-surface';
import { ModalBody } from './modal-body';
import { ModalButton } from './modal-button';
import { ModalFooter } from './modal-footer';

export type ConfirmationModalProps = {
  visible: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
};

type LatchedContent = {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  variant: 'default' | 'destructive';
};

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const { t } = useLingui();
  const resolvedConfirmLabel = confirmLabel ?? t`Confirm`;
  const resolvedCancelLabel = cancelLabel ?? t`Cancel`;
  // Keep last-seen content rendered while the modal animates closed so callers
  // can null out their source state on confirm/cancel without producing a
  // flash of empty content during the fade-out.
  const latchedRef = useRef<LatchedContent>({
    title,
    message,
    confirmLabel: resolvedConfirmLabel,
    cancelLabel: resolvedCancelLabel,
    variant,
  });
  if (visible) {
    latchedRef.current = {
      title,
      message,
      confirmLabel: resolvedConfirmLabel,
      cancelLabel: resolvedCancelLabel,
      variant,
    };
  }
  const display = visible
    ? {
        title,
        message,
        confirmLabel: resolvedConfirmLabel,
        cancelLabel: resolvedCancelLabel,
        variant,
      }
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
