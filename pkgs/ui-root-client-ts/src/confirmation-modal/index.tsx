/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { ModalBody, ModalButton, ModalFooter } from '../modal-parts/index';
import { ResponsiveSurface } from '../responsive-surface/index';

export type ConfirmationModalProps = {
  visible: boolean;
  title: JSX.Element;
  message: JSX.Element;
  confirmLabel?: JSX.Element | undefined;
  cancelLabel?: JSX.Element | undefined;
  variant?: 'default' | 'destructive' | undefined;
  /** Shown under `message` after a failed confirm (e.g. destructive error text). */
  confirmError?: JSX.Element | undefined;
  /** When true, both actions are disabled (e.g. while `onConfirm` is async). */
  submitting?: boolean | undefined;
  /** DOM `data-*` identifiers for the confirm button. */
  confirmDataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers for the cancel button. */
  cancelDataSet?: ComponentDataSet | undefined;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ConfirmationModalBody(props: {
  message: JSX.Element;
  confirmError: JSX.Element | undefined;
}): JSX.Element {
  const hasError = (): boolean =>
    props.confirmError !== undefined &&
    props.confirmError !== null &&
    props.confirmError !== false;
  return (
    <Show when={hasError()} fallback={<ModalBody message={props.message} />}>
      <ModalBody>
        <div class="box gap-2">
          <p class="text textBody text-text-secondary">{props.message}</p>
          <p class="text textCaption text-destructive">{props.confirmError}</p>
        </div>
      </ModalBody>
    </Show>
  );
}

/**
 * `ConfirmationModal` -- ready-made confirm/cancel dialog.
 *
 * Always a centered modal via {@link ResponsiveSurface} `presentation="modal"`
 * (never a bottom sheet), including on compact layouts.
 *
 * @example
 * ```tsx
 * <ConfirmationModal
 *   visible={show()}
 *   title="Delete item?"
 *   message="This action cannot be undone."
 *   variant="destructive"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShow(false)}
 * />
 * ```
 */
export function ConfirmationModal(props: ConfirmationModalProps): JSX.Element {
  const { t } = useLingui();
  const submitting = (): boolean => props.submitting ?? false;
  const handleClose = (): void => {
    if (!submitting()) props.onCancel();
  };
  const handleConfirm = (): void => {
    void props.onConfirm();
  };
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={handleClose}
      closable={!submitting()}
      title={props.title}
      presentation="modal"
      dataSet={{ component: 'ConfirmationModal', ...props.dataSet }}
    >
      <ConfirmationModalBody
        message={props.message}
        confirmError={props.confirmError}
      />
      <ModalFooter>
        <ModalButton
          label={props.confirmLabel ?? t`Confirm`}
          variant={props.variant === 'destructive' ? 'destructive' : 'default'}
          disabled={submitting()}
          onClick={handleConfirm}
          dataSet={{ action: 'confirm', ...props.confirmDataSet }}
        />
        <ModalButton
          label={props.cancelLabel ?? t`Cancel`}
          variant="cancel"
          disabled={submitting()}
          onClick={() => props.onCancel()}
          dataSet={{ action: 'cancel', ...props.cancelDataSet }}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
