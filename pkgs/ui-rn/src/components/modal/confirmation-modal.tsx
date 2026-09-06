/**
 * `ConfirmationModal` -- ready-made confirm/cancel dialog.
 *
 * Always a centered modal via {@link ResponsiveSurface} `presentation="modal"`
 * (never a bottom sheet), including on mobile.
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
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Box } from '../box';
import { ResponsiveSurface } from '../responsive-surface';
import { Text } from '../text';
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
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

type LatchedContent = {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  variant: 'default' | 'destructive';
  confirmError: ReactNode | undefined;
};

/**
 * Keep last-seen content rendered while the modal animates closed so callers
 * can null out their source state on confirm/cancel without producing a flash
 * of empty content during the fade-out.
 */
function useLatchedContent(
  visible: boolean,
  current: LatchedContent
): LatchedContent {
  const latchedRef = useRef<LatchedContent>(current);
  if (visible) {
    latchedRef.current = current;
  }
  return visible ? current : latchedRef.current;
}

function ConfirmationModalBody({
  message,
  confirmError,
}: {
  message: ReactNode;
  confirmError: ReactNode | undefined;
}) {
  const hasError =
    confirmError !== undefined &&
    confirmError !== null &&
    confirmError !== false;
  if (!hasError) {
    return <ModalBody message={message} />;
  }
  return (
    <ModalBody>
      <Box sx={{ gap: 2 }}>
        <Text variant="body" label={message} />
        <Text
          variant="caption"
          sx={{ color: 'destructive' }}
          label={confirmError}
        />
      </Box>
    </ModalBody>
  );
}

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
  dataSet,
}: ConfirmationModalProps) {
  const { t } = useLingui();
  const display = useLatchedContent(visible, {
    title,
    message,
    confirmLabel: confirmLabel ?? t`Confirm`,
    cancelLabel: cancelLabel ?? t`Cancel`,
    variant,
    confirmError,
  });
  const confirmVariant =
    display.variant === 'destructive' ? 'destructive' : 'default';
  const handleClose = submitting ? () => undefined : onCancel;
  const handleConfirm = () => {
    void onConfirm();
  };

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={handleClose}
      title={display.title}
      presentation="modal"
      {...componentDataSet('ConfirmationModal', dataSet)}
    >
      <ConfirmationModalBody
        message={display.message}
        confirmError={display.confirmError}
      />
      <ModalFooter>
        <ModalButton
          label={display.confirmLabel}
          variant={confirmVariant}
          disabled={submitting}
          onPress={handleConfirm}
        />
        <ModalButton
          label={display.cancelLabel}
          variant="cancel"
          disabled={submitting}
          onPress={onCancel}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
