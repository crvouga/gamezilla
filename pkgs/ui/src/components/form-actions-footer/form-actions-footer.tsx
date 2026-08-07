/**
 * `FormActionsFooter` -- the canonical Save / Cancel row for screen forms.
 *
 * Lives at the end of a form body (and is pinned to the bottom on mobile via
 * {@link ScreenBase}'s `footer` slot) instead of in the screen header. The
 * submit button runs the mutation through {@link useMutationButton}, so the
 * outcome reads in place: `Saving… -> Saved`, or a retryable error face -- every
 * form mutation surfaces its result the same way. Stay on the screen after save;
 * use Cancel (or breadcrumbs) to navigate away.
 *
 * @example
 * ```tsx
 * <FormActionsFooter
 *   cancel={{ label: t`Cancel`, onPress: () => router.back() }}
 *   submit={{
 *     label: t`Save`,
 *     loadingLabel: t`Saving…`,
 *     successLabel: t`Saved`,
 *     errorLabel: t`Couldn't save`,
 *     operation: save,
 *     disabled: !dirty,
 *   }}
 * />
 * ```
 */

import type { ReactNode } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Box } from '../box';
import { Button, type ButtonIntent } from '../button';
import { useMutationButton } from '../button/use-mutation-button';

export type FormSubmitAction = {
  /** Resting label (also the success/error fallback). */
  label: ReactNode;
  /** The save mutation. Wrap in `useCallback` for stability. */
  operation: () => Promise<void>;
  loadingLabel?: ReactNode | undefined;
  successLabel?: ReactNode | undefined;
  errorLabel?: ReactNode | undefined;
  /** Optional hook after the success face has been shown. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
  /** Success-face hold before `onSuccess`. Defaults to the hook default. */
  successHoldMs?: number | undefined;
  /** Disable submit (e.g. pristine / invalid form). */
  disabled?: boolean | undefined;
  /** Submit color role. Defaults to `'primary'`; use `'danger'` for deletes. */
  intent?: ButtonIntent | undefined;
};

export type FormCancelAction = {
  label: ReactNode;
  onPress: () => void;
  disabled?: boolean | undefined;
};

export type FormActionsFooterProps = {
  submit: FormSubmitAction;
  /** Optional secondary action (omit for save-only forms). */
  cancel?: FormCancelAction | undefined;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function FormActionsFooter({
  submit,
  cancel,
  dataSet,
}: FormActionsFooterProps): ReactNode {
  const mutation = useMutationButton({
    operation: submit.operation,
    labels: {
      idle: submit.label,
      loading: submit.loadingLabel,
      success: submit.successLabel,
      error: submit.errorLabel,
    },
    onSuccess: submit.onSuccess,
    onError: submit.onError,
    successHoldMs: submit.successHoldMs,
    disabled: submit.disabled,
  });

  return (
    <Box
      sx={{ flexDirection: 'row', gap: 2 }}
      {...componentDataSet('FormActionsFooter', dataSet)}
    >
      {cancel !== undefined ? (
        <Button
          title={cancel.label}
          intent="neutral"
          variant="outline"
          onPress={cancel.onPress}
          disabled={cancel.disabled ?? false}
          flex={1}
        />
      ) : null}
      <Button
        {...mutation.buttonProps}
        intent={submit.intent ?? 'primary'}
        flex={1}
      />
    </Box>
  );
}
