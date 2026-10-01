/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n';
import { Button, SendIcon, TextInput, useMutationButton } from '@pkgs/ui';
import { type Accessor, type JSX, Show } from 'solid-js';
import { FEEDBACK_TEMPLATES } from '../shared/templates';
import type { FeedbackKind } from '../shared/types';
import type { FeedbackController, FeedbackState } from './controller';
import { EvidenceControls } from './evidence-controls';

const TEMPLATE_COMMANDS: Readonly<Record<string, FeedbackKind>> = {
  '/bug': 'problem',
  '/feature': 'feature',
  '/gap': 'gap',
  '/polish': 'polish',
};

export function FeedbackForm(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const mutation = useMutationButton({
    operation: async () => {
      await props.controller.send();
      if (props.state().phase !== 'saved')
        throw new Error(
          props.state().message ?? 'Write something before sending feedback.'
        );
    },
    labels: {
      idle: 'Send',
      loading: 'Sending…',
      success: 'Sent',
      error: 'Try again',
    },
  });
  const workspace = () => {
    props.state();
    return props.controller.workspace.state();
  };
  const isUpdate = () =>
    workspace().documents.find((doc) => doc.id === workspace().activeId)
      ?.report !== null;
  const updateBody = (value: string): void => {
    const lines = value.split('\n');
    const command =
      TEMPLATE_COMMANDS[(lines.at(-1) ?? '').trim().toLowerCase()];
    if (!command) {
      props.controller.setDraft({ body: value });
      return;
    }
    const template = FEEDBACK_TEMPLATES.find((item) => item.kind === command);
    const existing = lines.slice(0, -1).join('\n').trimEnd();
    props.controller.setDraft({
      kind: command,
      body: [existing, template?.body ?? ''].filter(Boolean).join('\n\n'),
    });
  };
  return (
    <form
      class="box gap-3"
      data-testid="feedback-form"
      data-component="FeedbackForm"
      onSubmit={(event) => {
        event.preventDefault();
        void mutation.run();
      }}
    >
      <FeedbackEditor
        controller={props.controller}
        state={props.state}
        onChangeBody={updateBody}
        submit={
          <Button
            {...mutation.buttonProps}
            title={isUpdate() ? 'Save' : mutation.buttonProps.title}
            icon={SendIcon}
            type="submit"
            size="sm"
            onClick={undefined}
            onRetry={undefined}
            dataSet={{ testid: 'feedback-submit' }}
          />
        }
      />
      <Show when={props.state().message}>
        <p class="text text-sm text-warning" role="alert">
          {props.state().message}
        </p>
      </Show>
      <Show
        when={
          props.state().phase === 'failed' || props.controller.workspace.warning
        }
      >
        <details class="box rounded-xl border border-border px-3 py-2">
          <summary class="text text-sm font-medium cursor-pointer select-none py-1">
            Recovery data
          </summary>
          <div class="box mt-2">
            <TextInput
              multiline
              rows={5}
              readOnly
              aria-label={asLocalized('Machine-readable recovery data')}
              value={props.controller.emergencyCopy()}
              onChangeText={() => {
                /* Read-only recovery text. */
              }}
              fieldClass="font-mono text-xs"
              dataSet={{ testid: 'feedback-emergency' }}
            />
          </div>
        </details>
      </Show>
    </form>
  );
}

function FeedbackEditor(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
  onChangeBody: (value: string) => void;
  submit: JSX.Element;
}) {
  return (
    <div
      class="box overflow-hidden rounded-xl border border-border bg-surface"
      data-component="FeedbackEditor"
    >
      <TextInput
        name="title"
        aria-label={asLocalized('Feedback title')}
        placeholder={asLocalized('Title (optional)')}
        maxlength={240}
        value={props.state().draft.title}
        onChangeText={(title) => props.controller.setDraft({ title })}
        disabled={props.state().phase === 'sending'}
        class="gap-0"
        fieldClass="border-0 rounded-none bg-transparent font-semibold"
        dataSet={{ testid: 'feedback-title' }}
      />
      <TextInput
        multiline
        rows={11}
        name="body"
        aria-label={asLocalized('Feedback')}
        placeholder={asLocalized(
          'Describe what happened, what you expected, and what should improve.\n\nType /bug, /feature, /gap, or /polish for a guided outline.'
        )}
        maxlength={32000}
        class="gap-0 border-t border-border"
        fieldClass="border-0 rounded-none bg-transparent text-sm leading-relaxed"
        value={props.state().draft.body}
        onChangeText={props.onChangeBody}
        disabled={props.state().phase === 'sending'}
        invalid={props.state().errors.body !== undefined}
        dataSet={{ testid: 'feedback-body' }}
      />
      <div class="box flex-row items-center justify-between gap-2 border-t border-border px-2 py-2">
        <EvidenceControls controller={props.controller} />
        <div class="box flex-row items-center gap-2">
          <Show when={props.state().draft.body.length >= 28_000}>
            <p class="text textCaption">
              {props.state().draft.body.length.toString()} / 32,000
            </p>
          </Show>
          {props.submit}
        </div>
      </div>
    </div>
  );
}
