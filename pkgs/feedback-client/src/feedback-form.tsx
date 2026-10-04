/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n-shared/localized-string';
import { Button } from '@pkgs/ui-client/button';
import { MarkdownEditor } from '@pkgs/ui-client/markdown-editor';
import type { MarkdownEditorCommand } from '@pkgs/ui-shared/markdown-editor-types';
import { SendIcon } from '@pkgs/ui-client/icons';
import { TextInput } from '@pkgs/ui-client/text-input';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import { type Accessor, type JSX, Show } from 'solid-js';
import { FEEDBACK_TEMPLATES } from '@pkgs/feedback-shared/templates';
import type { FeedbackKind } from '@pkgs/feedback-shared/types';
import type { FeedbackController, FeedbackState } from './controller';
import { EvidenceControls } from './evidence-controls';

const TEMPLATE_COMMANDS: readonly MarkdownEditorCommand[] =
  FEEDBACK_TEMPLATES.map((template) => ({
    id: template.kind === 'problem' ? 'bug' : template.kind,
    label: template.label,
    description: template.label,
    aliases:
      template.kind === 'problem' ? ['bugfix', 'bugix', 'fix', 'problem'] : [],
    body: template.body,
  }));

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
  return (
    <form
      class="box flex-1 min-h-0 shrink gap-3 overflow-hidden"
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
        onSubmit={() => {
          void mutation.run();
        }}
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
  onSubmit: () => void;
  submit: JSX.Element;
}) {
  return (
    <div
      class="box flex-1 min-h-0 shrink overflow-hidden rounded-xl border border-border bg-surface"
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
      <MarkdownEditor
        aria-label="Feedback"
        placeholder={
          'Describe what happened, what you expected, and what should improve.\n\nType /bug, /feature, /gap, or /polish for a guided outline.'
        }
        maxLength={32000}
        value={props.state().draft.body}
        onChange={(body) => props.controller.setDraft({ body })}
        commands={TEMPLATE_COMMANDS}
        onCommand={(id) =>
          props.controller.setDraft({
            kind: id === 'bug' ? 'problem' : (id as FeedbackKind),
          })
        }
        onSubmit={props.onSubmit}
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
