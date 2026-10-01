/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n';
import {
  ChevronRightIcon,
  List,
  ListItem,
  SearchIcon,
  TextInput,
} from '@pkgs/ui';
import { type Accessor, createMemo, For, Show } from 'solid-js';
import type { FeedbackDocument } from '../shared/workspace';
import type { FeedbackController, FeedbackState } from './controller';

export function FeedbackManagement(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const search = () => {
    props.state();
    return props.controller.workspace.state().management.search;
  };
  const documents = createMemo(() => {
    props.state();
    const query = search().trim().toLowerCase();
    return props.controller.workspace.state().documents.filter((doc) => {
      const hasContent =
        doc.report !== null ||
        doc.title.trim().length > 0 ||
        doc.body.trim().length > 0 ||
        doc.recording !== null ||
        doc.files.length > 0;
      return (
        hasContent &&
        (!query || `${doc.title}\n${doc.body}`.toLowerCase().includes(query))
      );
    });
  });
  return (
    <div
      class="box gap-3"
      data-component="FeedbackManagement"
      data-testid="feedback-management"
    >
      <TextInput
        type="search"
        value={search()}
        onChangeText={(search) => props.controller.setManagement({ search })}
        placeholder={asLocalized('Search feedback')}
        aria-label={asLocalized('Search feedback')}
        startAdornment={<SearchIcon size={18} />}
        dataSet={{ testid: 'feedback-search' }}
      />
      <Show
        when={documents().length}
        fallback={
          <div class="box items-center px-4 py-8">
            <p class="text textCaption">No feedback yet.</p>
          </div>
        }
      >
        <List separator={false}>
          <For each={documents()}>
            {(doc) => (
              <FeedbackRow
                doc={doc}
                onOpen={() => {
                  void props.controller.select(doc.id);
                }}
              />
            )}
          </For>
        </List>
      </Show>
    </div>
  );
}

function FeedbackRow(props: { doc: FeedbackDocument; onOpen: () => void }) {
  const status = () => (props.doc.report ? 'Sent' : 'Draft');
  const excerpt = () =>
    props.doc.body
      .replace(/^#{1,6}\s+/gm, '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? 'No description yet';
  return (
    <ListItem
      title={props.doc.title || 'Untitled feedback'}
      subtitle={`${status()} · ${excerpt()}`}
      trailing={<ChevronRightIcon size={18} />}
      onClick={props.onOpen}
      dataSet={{
        component: 'FeedbackDocument',
        testid: `feedback-open-${props.doc.id}`,
      }}
    />
  );
}
