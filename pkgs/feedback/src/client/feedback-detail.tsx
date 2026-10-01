/** @jsxImportSource solid-js */
import {
  IconButton,
  MarkdownContent,
  MutationModal,
  ScrollView,
  SquarePenIcon,
  Trash2Icon,
} from '@pkgs/ui';
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
        <div
          class="box flex-1 min-h-0 shrink gap-4 overflow-hidden"
          data-component="FeedbackDetail"
        >
          <div class="box flex-row items-start justify-between gap-3">
            <div class="box min-w-0 gap-1">
              <h3 class="text text-lg font-semibold break-words">
                {doc().title || 'Untitled issue'}
              </h3>
              <p class="text textCaption">
                {doc().report ? 'Reported issue' : 'Draft'}
              </p>
            </div>
            <div
              class="box flex-row gap-1"
              role="group"
              aria-label="Issue actions"
              data-component="FeedbackActions"
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
            </div>
          </div>
          <ScrollView
            class="flex-1 min-h-0 shrink overflow-y-auto overscroll-contain rounded-xl border border-border"
            contentClass="p-4"
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
          <Show when={doc().issue?.url}>
            <a
              class="text text-sm text-tint"
              href={doc().issue?.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open external report ↗
            </a>
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
        </div>
      )}
    </Show>
  );
}
