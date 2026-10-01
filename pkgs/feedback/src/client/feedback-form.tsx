/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n';
import { Button, TextInput, useMutationButton } from '@pkgs/ui';
import { type Accessor, Show } from 'solid-js';
import type { FeedbackController, FeedbackState } from './controller';
import { EvidenceReview } from './evidence-review';

export function FeedbackForm(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const mutation = useMutationButton({
    operation: async () => {
      await props.controller.send();
      if (props.state().phase !== 'saved')
        throw new Error(
          props.state().message ?? 'Complete the highlighted fields.'
        );
    },
    labels: {
      idle: 'Send feedback',
      loading: 'Sending…',
      success: 'Sent',
      error: 'Try again',
    },
  });
  return (
    <form
      class="box gap-4"
      data-testid="feedback-form"
      onSubmit={(event) => {
        event.preventDefault();
        void mutation.run();
      }}
    >
      <FeedbackAnswers controller={props.controller} state={props.state} />
      <EvidenceReview controller={props.controller} />
      <p class="text textCaption">
        Page, device, app context, and available traces are attached
        automatically. Review recordings before sending.
      </p>
      <Show when={props.state().message}>
        <p class="text text-destructive" role="alert">
          {props.state().message}
        </p>
      </Show>
      <Show when={props.state().phase === 'failed'}>
        <TextInput
          disabled={props.state().phase === 'sending'}
          multiline
          rows={4}
          readOnly
          name="emergency"
          label="Keep an emergency copy"
          aria-label={asLocalized('Emergency copy')}
          value={props.controller.emergencyCopy()}
          onChangeText={() => {
            /* Read-only emergency copy. */
          }}
          dataSet={{ testid: 'feedback-emergency' }}
        />
      </Show>
      <Button
        {...mutation.buttonProps}
        type="submit"
        onClick={undefined}
        onRetry={undefined}
        dataSet={{ testid: 'feedback-submit' }}
      />
    </form>
  );
}

function FeedbackAnswers(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const problem = () => props.state().draft.kind === 'problem';
  const error = (key: 'description' | 'expected' | 'reproductionSteps') => {
    const message = props.state().errors[key];
    return message ? asLocalized(message) : undefined;
  };
  return (
    <>
      <TextInput
        disabled={props.state().phase === 'sending'}
        multiline
        rows={3}
        maxlength={32000}
        name="description"
        label={problem() ? 'What happened?' : 'What would you like to improve?'}
        aria-label={asLocalized('Description')}
        value={props.state().draft.description}
        error={error('description')}
        onChangeText={(description) =>
          props.controller.setDraft({ description })
        }
        dataSet={{ testid: 'feedback-description' }}
      />
      <TextInput
        disabled={props.state().phase === 'sending'}
        multiline
        rows={2}
        maxlength={32000}
        name="expected"
        label={
          problem() ? 'What did you expect?' : 'What would make this better?'
        }
        aria-label={asLocalized('Expected outcome')}
        value={props.state().draft.expected}
        error={error('expected')}
        onChangeText={(expected) => props.controller.setDraft({ expected })}
        dataSet={{ testid: 'feedback-expected' }}
      />
      <Show when={problem()}>
        <TextInput
          disabled={props.state().phase === 'sending'}
          multiline
          rows={3}
          maxlength={32000}
          name="reproductionSteps"
          label="How can we reproduce it?"
          aria-label={asLocalized('Reproduction steps')}
          value={props.state().draft.reproductionSteps}
          error={error('reproductionSteps')}
          helperText={asLocalized(
            'Record yourself reproducing it, or list the steps and the starting position.'
          )}
          onChangeText={(reproductionSteps) =>
            props.controller.setDraft({ reproductionSteps })
          }
          dataSet={{ testid: 'feedback-steps' }}
        />
      </Show>
    </>
  );
}
