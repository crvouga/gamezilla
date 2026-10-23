/** @jsxImportSource solid-js */

import { FEEDBACK_TEMPLATES } from '@pkgs/feedback-shared-ts/templates';
import type { FeedbackKind } from '@pkgs/feedback-shared-ts/types';
import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { Form } from '@pkgs/ui-root-client-ts/form';
import { SendIcon } from '@pkgs/ui-root-client-ts/icons';
import { MarkdownEditor } from '@pkgs/ui-root-client-ts/markdown-editor';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { MarkdownEditorCommand } from '@pkgs/ui-root-shared-ts/markdown-editor-types';
import { type Accessor, type JSX, Show } from 'solid-js';
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
    <Form
      grow
      gap="md"
      aria-label="Feedback"
      testId="feedback-form"
      onSubmit={() => {
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
        {(message) => (
          <P variant="caption" tone="warning" role="alert">
            {message()}
          </P>
        )}
      </Show>
      <Show
        when={
          props.state().phase === 'failed' || props.controller.workspace.warning
        }
      >
        <Surface tone="transparent" radius="card" border paddingX="md">
          <Collapsible title="Recovery data">
            <Textarea
              rows={5}
              readOnly
              aria-label={asLocalized('Machine-readable recovery data')}
              value={props.controller.emergencyCopy()}
              onValueChange={() => {
                /* Read-only recovery text. */
              }}
              testId="feedback-emergency"
            />
          </Collapsible>
        </Surface>
      </Show>
    </Form>
  );
}

function FeedbackEditor(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
  onSubmit: () => void;
  submit: JSX.Element;
}) {
  return (
    <Surface
      grow
      shrink
      tone="surface"
      radius="card"
      border
      overflow="hidden"
      testId="feedback-editor"
    >
      <TextInput
        name="title"
        aria-label={asLocalized('Feedback title')}
        placeholder={asLocalized('Title (optional)')}
        maxlength={240}
        value={props.state().draft.title}
        onChangeText={(title) => props.controller.setDraft({ title })}
        disabled={props.state().phase === 'sending'}
        variant="embedded"
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
      <Toolbar edge="top" tone="surface" justify="between" wrap>
        <EvidenceControls controller={props.controller} />
        <StackHorizontal align="center" gap="sm">
          <Show when={props.state().draft.body.length >= 28_000}>
            <P variant="caption" numeral>
              {props.state().draft.body.length.toString()} / 32,000
            </P>
          </Show>
          {props.submit}
        </StackHorizontal>
      </Toolbar>
    </Surface>
  );
}
