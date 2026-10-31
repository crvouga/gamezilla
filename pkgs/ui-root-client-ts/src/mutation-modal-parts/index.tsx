/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
/**
 * Phase bodies for {@link MutationModal}: idle (confirm / form), loading,
 * success (dismissible), error (retryable). Loading / success / error share
 * one fixed-height state band so phase swaps never grow the dialog.
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { ErrorState } from '../error-state/index';
import { LoadingState } from '../loading-state/index';
import { ModalBody, ModalButton, ModalFooter } from '../modal-parts/index';
import { MutationOutcomeUnknownError } from '../mutation-outcome-unknown-error';
import { SuccessState } from '../success-state/index';

export type MutationModalLabels = {
  submitLabel: JSX.Element;
  cancelLabel: JSX.Element | undefined;
  loadingLabel: JSX.Element | undefined;
  successTitle: JSX.Element;
  successBody: JSX.Element | undefined;
  errorTitle: JSX.Element | undefined;
  dismissLabel: JSX.Element | undefined;
  retryLabel: JSX.Element | undefined;
};

export type MutationModalIds = {
  submitDataSet: ComponentDataSet | undefined;
  cancelDataSet: ComponentDataSet | undefined;
  successDataSet: ComponentDataSet | undefined;
  dismissDataSet: ComponentDataSet | undefined;
};

/**
 * Fixed so loading / success / error share one state band (no grow). An
 * inline length, not `h-50`: the band's height is the budget the error's
 * retry is measured against (`feedback.test.tsx`).
 */
const MUTATION_STATE_AREA_HEIGHT = 200;

function StateArea(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="box justify-center overflow-hidden"
      style={{ height: cssPx(MUTATION_STATE_AREA_HEIGHT) }}
    >
      {props.children}
    </div>
  );
}

/** Footer band always present so phase swaps do not grow the modal. */
function FooterSlot(props: {
  children?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <ModalFooter>
      <Show
        when={props.children !== undefined}
        fallback={
          // Reserves one `Button` `md` row (44px) so phases never jump.
          <div class="box min-h-11" />
        }
      >
        {props.children}
      </Show>
    </ModalFooter>
  );
}

export function MutationLoading(props: {
  labels: MutationModalLabels;
  onClose: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <LoadingState caption={props.labels.loadingLabel ?? t`Working…`} />
      </StateArea>
      <p class="text textCaption text-text-secondary">
        {t`You can close this while we finish. Closing does not cancel your request.`}
      </p>
      <FooterSlot>
        <ModalButton
          label={t`Close`}
          variant="cancel"
          onClick={() => props.onClose()}
          dataSet={{ action: 'close-pending' }}
        />
      </FooterSlot>
    </>
  );
}

export function MutationSuccess(props: {
  labels: MutationModalLabels;
  ids: MutationModalIds;
  onDismiss: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <SuccessState
          title={props.labels.successTitle}
          body={props.labels.successBody}
          dataSet={props.ids.successDataSet}
        />
      </StateArea>
      <FooterSlot>
        <ModalButton
          label={props.labels.dismissLabel ?? t`Done`}
          onClick={() => props.onDismiss()}
          dataSet={{ action: 'dismiss', ...props.ids.dismissDataSet }}
        />
      </FooterSlot>
    </>
  );
}

export function MutationError(props: {
  ids: MutationModalIds;
  labels: MutationModalLabels;
  error: Error | null;
  onRetry: () => void;
  onClose: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const unknown = (): boolean =>
    props.error instanceof MutationOutcomeUnknownError;
  return (
    <>
      <StateArea>
        <ErrorState
          variant="band"
          title={
            unknown()
              ? t`Not confirmed yet`
              : (props.labels.errorTitle ?? t`Something went wrong`)
          }
          body={
            unknown()
              ? t`You can close this and keep using the app. Check again to learn the outcome of this choice.`
              : props.error?.message
          }
          retry={{
            dataSet: props.ids.submitDataSet,
            label: unknown()
              ? t`Check again`
              : (props.labels.retryLabel ?? t`Try again`),
            onClick: () => props.onRetry(),
          }}
        />
      </StateArea>
      <FooterSlot>
        <ModalButton
          label={unknown() ? t`Close` : (props.labels.cancelLabel ?? t`Cancel`)}
          variant="cancel"
          onClick={() => props.onClose()}
          dataSet={{ action: 'cancel' }}
        />
      </FooterSlot>
    </>
  );
}

export function MutationIdle(props: {
  labels: MutationModalLabels;
  ids: MutationModalIds;
  message: JSX.Element | undefined;
  /** Custom idle body (form fields); takes precedence over `message`. */
  children: JSX.Element | undefined;
  destructive: boolean;
  submitDisabled: boolean;
  onRun: () => void;
  onClose: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show
        when={props.children !== undefined}
        fallback={<ModalBody message={props.message} />}
      >
        <div class="box mb-4">{props.children}</div>
      </Show>
      <ModalFooter>
        <ModalButton
          label={props.labels.submitLabel}
          variant={props.destructive ? 'destructive' : 'default'}
          disabled={props.submitDisabled}
          onClick={() => props.onRun()}
          dataSet={{ action: 'submit', ...props.ids.submitDataSet }}
        />
        <ModalButton
          label={props.labels.cancelLabel ?? t`Cancel`}
          variant="cancel"
          onClick={() => props.onClose()}
          dataSet={{ action: 'cancel', ...props.ids.cancelDataSet }}
        />
      </ModalFooter>
    </>
  );
}
