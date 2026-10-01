/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n';
import { Button, TextInput, useMutationButton } from '@pkgs/ui';
import { type Accessor, For, Show } from 'solid-js';
import { FEEDBACK_TEMPLATES } from '../shared/templates';
import type { FeedbackController, FeedbackState } from './controller';
import { EvidenceReview } from './evidence-review';
import { MarkdownPreview } from './markdown-preview';

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
      idle: 'Send feedback',
      loading: 'Sending…',
      success: 'Sent',
      error: 'Try again',
    },
  });
  const workspace = () => {
    props.state();
    return props.controller.workspace.state();
  };
  const review = () => workspace().stage === 'review';
  return (
    <form
      class="box gap-4"
      data-testid="feedback-form"
      data-component="FeedbackForm"
      onSubmit={(event) => {
        event.preventDefault();
        void mutation.run();
      }}
    >
      <Show
        when={!review()}
        fallback={
          <FeedbackReview controller={props.controller} state={props.state} />
        }
      >
        <FeedbackEditor controller={props.controller} state={props.state} />
      </Show>
      <Show when={props.state().message}>
        <p class="text text-destructive" role="alert">
          {props.state().message}
        </p>
      </Show>
      <Show
        when={
          props.state().phase === 'failed' || props.controller.workspace.warning
        }
      >
        <TextInput
          multiline
          rows={4}
          readOnly
          label="Keep a copy"
          value={props.controller.emergencyCopy()}
          onChangeText={() => {
            /* Read-only recovery text. */
          }}
          dataSet={{ testid: 'feedback-emergency' }}
        />
      </Show>
      <div class="box flex-row gap-2 border-t border-border pt-4">
        <Button
          title={review() ? 'Back to writing' : 'Review feedback'}
          variant="outline"
          fullWidth
          disabled={props.state().phase === 'sending'}
          onClick={() =>
            props.controller.setStage(review() ? 'write' : 'review')
          }
          dataSet={{ testid: 'feedback-next' }}
        />
        <Show when={review()}>
          <Button
            {...mutation.buttonProps}
            title={
              workspace().documents.find((d) => d.id === workspace().activeId)
                ?.report
                ? 'Save changes'
                : mutation.buttonProps.title
            }
            type="submit"
            onClick={undefined}
            onRetry={undefined}
            fullWidth
            dataSet={{ testid: 'feedback-submit' }}
          />
        </Show>
      </div>
    </form>
  );
}
function FeedbackEditor(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  return (
    <div class="box gap-4" data-component="FeedbackEditor">
      <div class="box gap-2">
        <p class="text textCaption">START WITH A TEMPLATE · OPTIONAL</p>
        <div class="box flex-row flex-wrap gap-2">
          <For each={FEEDBACK_TEMPLATES}>
            {(template) => (
              <Button
                title={template.label}
                size="sm"
                variant="outline"
                disabled={props.state().phase === 'sending'}
                onClick={() => props.controller.applyTemplate(template.kind)}
                dataSet={{ testid: `feedback-template-${template.kind}` }}
              />
            )}
          </For>
        </div>
      </div>
      <TextInput
        name="title"
        label="Title"
        placeholder={asLocalized('A short headline, if you like')}
        maxlength={240}
        value={props.state().draft.title}
        onChangeText={(title) => props.controller.setDraft({ title })}
        disabled={props.state().phase === 'sending'}
        dataSet={{ testid: 'feedback-title' }}
      />
      <TextInput
        multiline
        rows={11}
        name="description"
        label="Your feedback"
        placeholder={asLocalized(
          'Write freely. Headings, lists, links, and code are welcome.'
        )}
        maxlength={32000}
        fieldClass="font-mono text-sm leading-relaxed"
        value={props.state().draft.description}
        onChangeText={(description) =>
          props.controller.setDraft({ description })
        }
        disabled={props.state().phase === 'sending'}
        error={
          props.state().errors.description
            ? asLocalized(props.state().errors.description ?? '')
            : undefined
        }
        dataSet={{ testid: 'feedback-description' }}
      />
      <div class="box flex-row justify-between">
        <p class="text textCaption">Markdown · your words, your structure</p>
        <p class="text textCaption">
          {props.state().draft.description.length.toString()} / 32,000
        </p>
      </div>
    </div>
  );
}
function FeedbackReview(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const attachments = () => {
    props.state();
    return props.controller.workspace.active()?.report?.attachments ?? [];
  };
  return (
    <div class="box gap-4" data-component="FeedbackReview">
      <div class="box gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 class="text font-semibold text-lg">
          {props.state().draft.title || 'Untitled feedback'}
        </h2>
        <MarkdownPreview value={props.state().draft.description} />
      </div>
      <EvidenceReview controller={props.controller} />
      <For each={attachments()}>
        {(file) => (
          <div class="box flex-row justify-between gap-2">
            <a
              class="text text-tint"
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {file.name}
            </a>
            <Button
              title="Remove"
              variant="ghost"
              onClick={() => props.controller.removeRemoteAttachment(file.id)}
            />
          </div>
        )}
      </For>
      <p class="text textCaption">
        Available diagnostics are included automatically. Recordings and
        attachments are optional.
      </p>
    </div>
  );
}
