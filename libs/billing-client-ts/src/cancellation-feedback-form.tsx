import type {
  CancellationFeedback,
  CancellationReason,
} from '@libs/billing-shared-ts/cancellation-feedback';
import { CANCELLATION_COMMENT_LIMIT } from '@libs/billing-shared-ts/cancellation-feedback';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createEffect, createSignal, type JSX, Show, untrack } from 'solid-js';

export type CancellationFeedbackFormProps = {
  readonly saved: CancellationFeedback | null;
  readonly online: boolean;
  readonly delivery?: 'pending' | 'confirmed' | 'rejected' | null;
  readonly onSave: (answer: CancellationFeedback) => Promise<void>;
};

/** Optional feedback after cancellation; saving never controls billing actions. */
export function CancellationFeedbackForm(
  props: CancellationFeedbackFormProps
): JSX.Element {
  const { t } = useLingui();
  const [reason, setReason] = createSignal<CancellationReason>('');
  const [comment, setComment] = createSignal('');
  const [dirty, setDirty] = createSignal(false);
  createEffect(() => {
    const saved = props.saved;
    if (saved === null || untrack(dirty)) return;
    setReason(saved.reason);
    setComment(saved.comment);
  });
  const save = useMutationButton({
    operation: async () => {
      await props.onSave({ reason: reason(), comment: comment() });
      setDirty(false);
    },
    labels: {
      idle: t`Save feedback`,
      loading: t`Saving…`,
      success: t`Saved`,
      error: t`Try saving again`,
    },
  });
  createEffect(() => {
    if (props.delivery === 'rejected') save.reset();
  });
  return (
    <StackVertical gap="md" testId="billing-cancellation-feedback">
      <H2>
        <Trans>Help us improve Plus</Trans>
      </H2>
      <P>
        <Trans>
          Your cancellation is already arranged. Sharing a reason or comment is
          optional and will not change it.
        </Trans>
      </P>
      <CancellationReasonSelect
        value={reason()}
        disabled={save.feedback() === 'loading'}
        onChange={(value) => {
          save.reset();
          setDirty(true);
          setReason(value);
        }}
      />
      <FormField
        label={t`Comment (optional)`}
        help={t`Please leave out payment details or other sensitive information.`}
      >
        {() => (
          <Textarea
            value={comment()}
            onValueChange={(value) => {
              save.reset();
              setDirty(true);
              setComment(value);
            }}
            disabled={save.feedback() === 'loading'}
            maxLength={CANCELLATION_COMMENT_LIMIT}
            showCount
            testId="billing-feedback-comment"
          />
        )}
      </FormField>
      <Button
        {...save.buttonProps}
        dataSet={{ testid: 'billing-feedback-save' }}
      />
      <Show when={save.error() || props.delivery === 'rejected'}>
        <P role="alert">
          <Trans>
            Your feedback could not be saved. Your answer is still here. Try
            saving again; your cancellation is unchanged.
          </Trans>
        </P>
      </Show>
      <Show
        when={props.saved !== null && !dirty() && props.delivery !== 'rejected'}
      >
        <P role="status" testId="billing-feedback-saved">
          <Show
            when={props.delivery === 'pending'}
            fallback={
              <Trans>Feedback saved. Thank you for helping us improve.</Trans>
            }
          >
            <Trans>
              Feedback saved on this device. Waiting to share it with the team.
            </Trans>
          </Show>
        </P>
      </Show>
      <Show when={!props.online}>
        <P role="status">
          <Trans>
            You are offline. Saved feedback will be shared when your connection
            returns.
          </Trans>
        </P>
      </Show>
    </StackVertical>
  );
}

function CancellationReasonSelect(props: {
  readonly value: CancellationReason;
  readonly disabled: boolean;
  readonly onChange: (value: CancellationReason) => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Select<CancellationReason>
      label={t`Reason (optional)`}
      disabled={props.disabled}
      value={props.value}
      onValueChange={props.onChange}
      triggerDataSet={{ testid: 'billing-feedback-reason' }}
      options={[
        {
          value: '',
          label: t`Prefer not to say`,
          dataSet: { testid: 'billing-feedback-option-none' },
        },
        {
          value: 'price',
          label: t`Too expensive`,
          dataSet: { testid: 'billing-feedback-option-price' },
        },
        {
          value: 'missing features',
          label: t`Missing features`,
          dataSet: { testid: 'billing-feedback-option-missing-features' },
        },
        {
          value: 'difficulty using the app',
          label: t`Difficult to use`,
          dataSet: {
            testid: 'billing-feedback-option-difficulty-using-the-app',
          },
        },
        {
          value: 'low usage',
          label: t`Not using it enough`,
          dataSet: { testid: 'billing-feedback-option-low-usage' },
        },
        {
          value: 'switching products',
          label: t`Using something else`,
          dataSet: { testid: 'billing-feedback-option-switching-products' },
        },
        {
          value: 'other',
          label: t`Another reason`,
          dataSet: { testid: 'billing-feedback-option-other' },
        },
      ]}
    />
  );
}
