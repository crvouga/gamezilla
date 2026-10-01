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
      <FeedbackEditor controller={props.controller} state={props.state} />
      <details class="box rounded-xl border border-border bg-surface-muted px-3 py-2">
        <summary class="text text-sm font-medium cursor-pointer select-none py-1">
          Preview
        </summary>
        <div class="box border-t border-border mt-2 pt-3">
          <MarkdownPreview value={props.state().draft.body} />
        </div>
      </details>
      <FeedbackContext controller={props.controller} state={props.state} />
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
      <div class="box border-t border-border pt-4">
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
        <p class="text textLabel">Optional template</p>
        <div class="box flex-row flex-wrap gap-2">
          <For each={FEEDBACK_TEMPLATES}>
            {(template) => (
              <Button
                title={template.label}
                size="sm"
                variant={
                  props.state().draft.kind === template.kind
                    ? 'solid'
                    : 'outline'
                }
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
        rows={9}
        name="body"
        label="Your feedback"
        placeholder={asLocalized(
          'Write freely. Headings, lists, links, and code are welcome.'
        )}
        maxlength={32000}
        fieldClass="font-mono text-sm leading-relaxed"
        value={props.state().draft.body}
        onChangeText={(body) => props.controller.setDraft({ body })}
        disabled={props.state().phase === 'sending'}
        error={
          props.state().errors.body
            ? asLocalized(props.state().errors.body ?? '')
            : undefined
        }
        dataSet={{ testid: 'feedback-body' }}
      />
      <div class="box flex-row justify-between">
        <p class="text textCaption">Markdown supported</p>
        <p class="text textCaption">
          {props.state().draft.body.length.toString()} / 32,000
        </p>
      </div>
    </div>
  );
}
function FeedbackContext(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const attachments = () => {
    props.state();
    return props.controller.workspace.active()?.report?.attachments ?? [];
  };
  return (
    <details class="box rounded-xl border border-border bg-surface-muted px-3 py-2">
      <summary class="text text-sm font-medium cursor-pointer select-none py-1">
        Add context
      </summary>
      <div class="box gap-3 border-t border-border mt-2 pt-3">
        <EvidenceReview controller={props.controller} />
        <For each={attachments()}>
          {(file) => (
            <div class="box flex-row items-center justify-between gap-2">
              <a
                class="text text-sm text-tint truncate"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.name}
              </a>
              <Button
                title="Remove"
                size="sm"
                variant="ghost"
                onClick={() => props.controller.removeRemoteAttachment(file.id)}
              />
            </div>
          )}
        </For>
        <p class="text textCaption">
          Diagnostics are automatic. Recordings and attachments are optional.
        </p>
      </div>
    </details>
  );
}
