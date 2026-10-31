/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { children, createMemo, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import type { ButtonIntent } from '../button-face';
import { useLayoutMode } from '../use-layout-mode';
import {
  type UseMutationButtonResult,
  useMutationButton,
} from '../use-mutation-button/index';

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

/** Shared controller for both native screen forms and standalone commands. */
export function useFormActions(
  props: FormActionsFooterProps
): UseMutationButtonResult {
  // Action getters may construct JSX. Resolve them under the component owner,
  // then read the cached action from asynchronous mutation callbacks.
  const submit = createMemo(() => props.submit);
  return useMutationButton({
    operation: () => submit().operation(),
    labels: {
      get idle() {
        return submit().label;
      },
      get loading() {
        return submit().loadingLabel;
      },
      get success() {
        return submit().successLabel;
      },
      get error() {
        return submit().errorLabel;
      },
    },
    onSuccess: () => submit().onSuccess?.(),
    onError: (error) => submit().onError?.(error),
    get successHoldMs() {
      return submit().successHoldMs;
    },
    get disabled() {
      return submit().disabled;
    },
  });
}

/**
 * `FormActionsFooter` -- the canonical Save / Cancel row for screen forms.
 *
 * Lives at the end of a form body (pinned to the bottom via the screen
 * `footer` slot) instead of in the screen header. The submit button runs the
 * mutation through {@link useMutationButton}, so the outcome reads in place:
 * `Saving… -> Saved`, or a retryable error face. Stay on the screen after
 * save; use Cancel (or breadcrumbs) to navigate away.
 *
 * The primary action comes first in reading and tab order. On phones
 * (compact) it is a full-width pill pinned where the thumb is, with Cancel
 * full width under it; on wide layouts the two share one row, the primary on
 * the right.
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
export function FormActionsFooter(props: FormActionsFooterProps): JSX.Element {
  const mutation = useFormActions(props);
  return (
    <FormActionsFooterView
      {...props}
      mutation={mutation}
      submitMode="command"
    />
  );
}

/** Controlled footer: native forms submit through their owning form event. */
export function FormActionsFooterView(
  props: FormActionsFooterProps & {
    mutation: UseMutationButtonResult;
    submitMode: 'form' | 'command';
  }
): JSX.Element {
  const mode = useLayoutMode();
  const compact = (): boolean => mode() !== 'wide';
  return (
    <div
      class="box gap-2"
      classList={{
        'flex-col items-stretch': compact(),
        'flex-row-reverse': !compact(),
      }}
      {...dataAttrs({
        component: 'FormActionsFooter',
        layout: compact() ? 'stacked' : 'row',
        ...props.dataSet,
      })}
    >
      <Button
        {...props.mutation.buttonProps}
        type="submit"
        onClick={
          props.submitMode === 'command'
            ? props.mutation.buttonProps.onClick
            : undefined
        }
        onRetry={
          props.submitMode === 'command'
            ? props.mutation.buttonProps.onRetry
            : undefined
        }
        intent={props.submit.intent ?? 'primary'}
        flex={compact() ? undefined : 1}
        fullWidth={compact()}
        dataSet={{ component: 'FormSubmitButton', ...props.submit.dataSet }}
      />
      <Show when={props.cancel}>
        {(cancel) => (
          <Button
            title={cancel().label}
            intent="neutral"
            variant="outline"
            onClick={() => cancel().onClick()}
            disabled={cancel().disabled ?? false}
            flex={compact() ? undefined : 1}
            fullWidth={compact()}
            dataSet={{ component: 'FormCancelButton', ...cancel().dataSet }}
          />
        )}
      </Show>
      <FormActionsFeedback submit={props.submit} mutation={props.mutation} />
    </div>
  );
}

function feedbackText(value: JSX.Element): string {
  if (Array.isArray(value)) return value.map(feedbackText).join('');
  if (value instanceof Node) return value.textContent ?? '';
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

/** Read lazy translated labels without moving their DOM nodes out of the button. */
function FormActionsFeedback(props: {
  submit: FormSubmitAction;
  mutation: UseMutationButtonResult;
}): JSX.Element {
  const message = children(() => {
    const phase = props.mutation.feedback();
    if (phase === 'idle') return undefined;
    if (phase === 'loading')
      return props.submit.loadingLabel ?? props.submit.label;
    if (phase === 'success')
      return props.submit.successLabel ?? props.submit.label;
    return props.submit.errorLabel ?? props.submit.label;
  });
  return (
    <span
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...dataAttrs({ component: 'FormActionsFeedback' })}
    >
      {feedbackText(message())}
    </span>
  );
}
