/** @jsxImportSource solid-js */
import {
  MutationModal,
  OverflowMenuButton,
  SquarePenIcon,
  Trash2Icon,
} from '@pkgs/ui';
import { type Accessor, createSignal, Show } from 'solid-js';
import type { FeedbackController, FeedbackState } from './controller';
import { MarkdownPreview } from './markdown-preview';

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
        <div class="box gap-4" data-component="FeedbackDetail">
          <div class="box flex-row items-start justify-between gap-3">
            <div class="box min-w-0 gap-1">
              <h3 class="text text-lg font-semibold break-words">
                {doc().title || 'Untitled issue'}
              </h3>
              <p class="text textCaption">
                {doc().report ? 'Reported issue' : 'Draft'}
              </p>
            </div>
            <OverflowMenuButton
              aria-label="Issue actions"
              header={{ title: doc().title || 'Untitled issue' }}
              actions={[
                {
                  id: 'edit',
                  label: 'Edit issue',
                  icon: SquarePenIcon,
                  onClick: props.controller.edit,
                  dataSet: { testid: `feedback-edit-${doc().id}` },
                },
                {
                  id: 'delete',
                  label: 'Delete issue',
                  icon: Trash2Icon,
                  onClick: () => setDeleting(true),
                  dataSet: { testid: `feedback-delete-${doc().id}` },
                },
              ]}
              dataSet={{ testid: 'feedback-actions' }}
            />
          </div>
          <div class="box rounded-xl border border-border p-4">
            <MarkdownPreview value={doc().body} />
          </div>
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
