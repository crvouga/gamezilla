/** @jsxImportSource solid-js */
import { Button, MutationModal, TextInput } from '@pkgs/ui';
import { type Accessor, createMemo, createSignal, For, Show } from 'solid-js';
import type { FeedbackDocument } from '../shared/workspace';
import type { FeedbackController, FeedbackState } from './controller';

export function FeedbackManagement(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const management = () => {
    props.state();
    return props.controller.workspace.state().management;
  };
  const search = () => management().search;
  const filter = () => management().filter;
  const setSearch = (search: string) =>
    props.controller.setManagement({ search });
  const setFilter = (filter: 'all' | 'draft' | 'sent') =>
    props.controller.setManagement({ filter });
  const [deleting, setDeleting] = createSignal<string | null>(null);
  const documents = createMemo(() => {
    props.state();
    return props.controller.workspace
      .state()
      .documents.filter(
        (doc) =>
          (filter() === 'all' ||
            (filter() === 'sent') === (doc.report !== null)) &&
          `${doc.title}\n${doc.description}`
            .toLowerCase()
            .includes(search().toLowerCase())
      );
  });
  const chosen = createMemo(() => {
    props.state();
    return props.controller.workspace
      .state()
      .documents.find((d) => d.id === deleting());
  });
  return (
    <div
      class="box gap-4"
      data-component="FeedbackManagement"
      data-testid="feedback-management"
    >
      <div class="box flex-row items-center justify-between">
        <h2 class="text font-semibold">Your feedback</h2>
        <Button
          title="New feedback"
          size="sm"
          onClick={() => {
            void props.controller.newDraft();
          }}
          dataSet={{ testid: 'feedback-new' }}
        />
      </div>
      <TextInput
        label="Find feedback"
        value={search()}
        onChangeText={setSearch}
        dataSet={{ testid: 'feedback-search' }}
      />
      <div class="box flex-row gap-2">
        <For each={['all', 'draft', 'sent'] as const}>
          {(value) => (
            <Button
              title={
                value === 'all' ? 'All' : value === 'draft' ? 'Drafts' : 'Sent'
              }
              variant={filter() === value ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setFilter(value)}
            />
          )}
        </For>
      </div>
      <Show
        when={documents().length}
        fallback={
          <div class="box rounded-xl border border-dashed border-border p-6 gap-2">
            <p class="text font-semibold">A clean slate</p>
            <p class="text textCaption">
              Your drafts and sent feedback will live here. Start with an
              observation.
            </p>
          </div>
        }
      >
        <For each={documents()}>
          {(doc) => (
            <FeedbackRow
              doc={doc}
              controller={props.controller}
              onDelete={() => setDeleting(doc.id)}
            />
          )}
        </For>
      </Show>
      <FeedbackDelete
        controller={props.controller}
        id={deleting()}
        title={chosen()?.title ?? ''}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function FeedbackRow(props: {
  doc: FeedbackDocument;
  controller: FeedbackController;
  onDelete: () => void;
}) {
  return (
    <article
      class="box rounded-xl border border-border bg-surface p-4 gap-2"
      data-component="FeedbackDocument"
      data-testid={`feedback-document-${props.doc.id}`}
    >
      <div class="box flex-row items-start justify-between gap-3">
        <h3 class="text font-semibold">
          {props.doc.title || 'Untitled feedback'}
        </h3>
        <span class="text textCaption rounded-full border border-border px-2 py-1">
          {props.doc.report ? 'Sent' : 'Draft'}
        </span>
      </div>
      <p class="text textCaption line-clamp-2 whitespace-pre-wrap">
        {props.doc.description || 'Waiting for your first thought…'}
      </p>
      <div class="box flex-row gap-2">
        <Button
          title={props.doc.report ? 'Edit report' : 'Continue writing'}
          variant="outline"
          size="sm"
          onClick={() => {
            void props.controller.select(props.doc.id);
          }}
          dataSet={{ testid: `feedback-edit-${props.doc.id}` }}
        />
        <Button
          title="Delete"
          variant="ghost"
          intent="danger"
          size="sm"
          onClick={props.onDelete}
          dataSet={{ testid: `feedback-delete-${props.doc.id}` }}
        />
        <Show when={props.doc.issue?.url}>
          <a
            class="text textCaption text-tint self-center"
            href={props.doc.issue?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open report ↗
          </a>
        </Show>
      </div>
    </article>
  );
}

function FeedbackDelete(props: {
  controller: FeedbackController;
  id: string | null;
  title: string;
  onClose: () => void;
}) {
  const remove = async () => {
    const id = props.id;
    if (id) await props.controller.remove(id);
  };
  return (
    <MutationModal
      visible={props.id !== null}
      onClose={props.onClose}
      title="Delete feedback?"
      message={`Delete “${props.title || 'Untitled feedback'}”? This removes it from your feedback.`}
      operation={remove}
      submitLabel="Delete feedback"
      variant="destructive"
      successTitle="Feedback deleted"
      stackId="feedback-delete"
      submitDataSet={{ testid: 'feedback-delete-confirm' }}
      dismissDataSet={{ testid: 'feedback-delete-done' }}
      dataSet={{ testid: 'feedback-delete-dialog' }}
    />
  );
}
