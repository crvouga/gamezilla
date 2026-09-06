/** @jsxImportSource solid-js */
/**
 * `FormActionsFooter` -- the canonical Save / Cancel row for screen forms.
 *
 * Lives at the end of a form body (pinned to the bottom via the screen
 * `footer` slot) instead of in the screen header. The submit button runs the
 * mutation through {@link useMutationButton}, so the outcome reads in place:
 * `Saving… -> Saved`, or a retryable error face. Stay on the screen after
 * save; use Cancel (or breadcrumbs) to navigate away.
 *
 * @example
 * ```tsx
 * <FormActionsFooter
 *   cancel={{ label: t`Cancel`, onClick: () => navigate(-1) }}
 *   submit={{
 *     label: t`Save`,
 *     loadingLabel: t`Saving…`,
 *     successLabel: t`Saved`,
 *     errorLabel: t`Couldn't save`,
 *     operation: save,
 *     disabled: !dirty(),
 *   }}
 * />
 * ```
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Button, type ButtonIntent, useMutationButton } from '../button';

export type FormSubmitAction = {
  /** Resting label (also the success/error fallback). */
  label: JSX.Element;
  /** The save mutation. */
  operation: () => Promise<void>;
  loadingLabel?: JSX.Element | undefined;
  successLabel?: JSX.Element | undefined;
  errorLabel?: JSX.Element | undefined;
  /** Optional hook after the success face has been shown. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
  /** Success-face hold before `onSuccess`. Defaults to the hook default. */
  successHoldMs?: number | undefined;
  /** Disable submit (e.g. pristine / invalid form). */
  disabled?: boolean | undefined;
  /** Submit color role. Defaults to `'primary'`; use `'danger'` for deletes. */
  intent?: ButtonIntent | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type FormCancelAction = {
  label: JSX.Element;
  onClick: () => void;
  disabled?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type FormActionsFooterProps = {
  submit: FormSubmitAction;
  /** Optional secondary action (omit for save-only forms). */
  cancel?: FormCancelAction | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function FormActionsFooter(props: FormActionsFooterProps): JSX.Element {
  const mutation = useMutationButton({
    operation: () => props.submit.operation(),
    labels: {
      get idle() {
        return props.submit.label;
      },
      get loading() {
        return props.submit.loadingLabel;
      },
      get success() {
        return props.submit.successLabel;
      },
      get error() {
        return props.submit.errorLabel;
      },
    },
    onSuccess: () => props.submit.onSuccess?.(),
    onError: (error) => props.submit.onError?.(error),
    get successHoldMs() {
      return props.submit.successHoldMs;
    },
    get disabled() {
      return props.submit.disabled;
    },
  });

  return (
    <Box
      sx={{ flexDirection: 'row', gap: 2 }}
      dataSet={{ component: 'FormActionsFooter', ...props.dataSet }}
    >
      <Show when={props.cancel}>
        {(cancel) => (
          <Button
            title={cancel().label}
            intent="neutral"
            variant="outline"
            onClick={() => cancel().onClick()}
            disabled={cancel().disabled ?? false}
            flex={1}
            dataSet={{ component: 'FormCancelButton', ...cancel().dataSet }}
          />
        )}
      </Show>
      <Button
        {...mutation.buttonProps}
        type="submit"
        intent={props.submit.intent ?? 'primary'}
        flex={1}
        dataSet={{ component: 'FormSubmitButton', ...props.submit.dataSet }}
      />
    </Box>
  );
}
