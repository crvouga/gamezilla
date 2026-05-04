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
import { Box } from '../box';
import { Text } from '../text';
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
  /** Shown under {@link message} after a failed confirm (e.g. destructive error text). */
  confirmError?: ReactNode;
  /** When true, both actions are disabled (e.g. while {@link onConfirm} is async). */
  submitting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

type LatchedContent = {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  variant: 'default' | 'destructive';
  confirmError: ReactNode | undefined;
};

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  confirmError,
  submitting = false,
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
    confirmError: confirmError ?? undefined,
  });
  if (visible) {
    latchedRef.current = {
      title,
      message,
      confirmLabel: resolvedConfirmLabel,
      cancelLabel: resolvedCancelLabel,
      variant,
      confirmError,
    };
  }
  const display = visible
    ? {
        title,
        message,
        confirmLabel: resolvedConfirmLabel,
        cancelLabel: resolvedCancelLabel,
        variant,
        confirmError,
      }
    : latchedRef.current;

  const body =
    display.confirmError !== undefined &&
    display.confirmError !== null &&
    display.confirmError !== false ? (
      <ModalBody>
        <Box sx={{ gap: 2 }}>
          <Text variant="body" label={display.message} />
          <Text
            variant="caption"
            sx={{ color: 'destructive' }}
            label={display.confirmError}
          />
        </Box>
      </ModalBody>
    ) : (
      <ModalBody message={display.message} />
    );

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={submitting ? () => undefined : onCancel}
      title={display.title}
    >
      {body}
      <ModalFooter>
        <ModalButton
          label={display.cancelLabel}
          variant="cancel"
          disabled={submitting}
          onPress={onCancel}
        />
        <ModalButton
          label={display.confirmLabel}
          variant={
            display.variant === 'destructive' ? 'destructive' : 'default'
          }
          disabled={submitting}
          onPress={() => {
            void onConfirm();
          }}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
