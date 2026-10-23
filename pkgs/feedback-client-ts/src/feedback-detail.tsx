/** @jsxImportSource solid-js */

import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { SquarePenIcon, Trash2Icon } from '@pkgs/ui-root-client-ts/icons';
import { MarkdownContent } from '@pkgs/ui-root-client-ts/markdown-content';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { type Accessor, createSignal, Show } from 'solid-js';
import type { FeedbackController, FeedbackState } from './controller';

export function FeedbackDetail(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const [deleting, setDeleting] = createSignal(false);
  const document = () => {
    props.state();
    return props.controller.workspace.active();
  };
  return (
    <Show when={document()}>
      {(doc) => (
        <StackVertical
          grow
          shrink
          gap="lg"
          overflow="hidden"
          testId="feedback-detail"
        >
          <StackHorizontal align="start" justify="between" gap="md">
            <StackVertical shrink gap="xs">
              <H3 size="subtitle">{doc().title || 'Untitled issue'}</H3>
              <P variant="caption">
                {doc().report ? 'Reported issue' : 'Draft'}
              </P>
            </StackVertical>
            <StackHorizontal
              gap="xs"
              role="group"
              aria-label="Issue actions"
              testId="feedback-issue-actions"
            >
              <IconButton
                label="Edit issue"
                tooltip="default"
                tooltipFloating
                tooltipPlacement="top"
                onClick={props.controller.edit}
                dataSet={{ testid: `feedback-edit-${doc().id}` }}
              >
                <SquarePenIcon size={18} />
              </IconButton>
              <IconButton
                label="Delete issue"
                tooltip="default"
                tooltipFloating
                tooltipPlacement="top"
                onClick={() => setDeleting(true)}
                dataSet={{ testid: `feedback-delete-${doc().id}` }}
              >
                <Trash2Icon size={18} />
              </IconButton>
            </StackHorizontal>
          </StackHorizontal>
          <Surface
            grow
            shrink
            tone="transparent"
            radius="card"
            border
            overflow="hidden"
          >
            <ScrollView
              grow
              padding="lg"
              flushEdge={false}
              role="region"
              aria-label="Issue description"
              tabIndex={0}
            >
              <MarkdownContent
                value={doc().body}
                dataSet={{ testid: 'feedback-markdown-preview' }}
              />
            </ScrollView>
          </Surface>
          <Show when={doc().issue?.url}>
            {(url) => (
              <TextLink href={url()} external variant="standalone">
                Open external report
              </TextLink>
            )}
          </Show>
          <MutationModal
            visible={deleting()}
            onClose={() => setDeleting(false)}
            title="Delete issue?"
            message={`Delete “${doc().title || 'Untitled issue'}”? This cannot be undone.`}
            operation={() => props.controller.remove(doc().id)}
            submitLabel="Delete issue"
            variant="destructive"
            successTitle="Issue deleted"
            stackId="feedback-delete"
            submitDataSet={{ testid: 'feedback-delete-confirm' }}
            dismissDataSet={{ testid: 'feedback-delete-done' }}
            dataSet={{ testid: 'feedback-delete-dialog' }}
          />
        </StackVertical>
      )}
    </Show>
  );
}
