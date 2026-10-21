/** @jsxImportSource solid-js */

import type { FeedbackDocument } from '@pkgs/feedback-shared/workspace';
import { asLocalized } from '@pkgs/i18n-shared/localized-string';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import {
  ChevronRightIcon,
  SearchIcon,
  SquarePenIcon,
} from '@pkgs/ui-root-client/icons';
import { List, ListItem } from '@pkgs/ui-root-client/list';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { type Accessor, createMemo, For, Show } from 'solid-js';
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
    <StackVertical
      grow
      shrink
      gap="md"
      overflow="hidden"
      testId="feedback-management"
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
          <EmptyState
            variant="compact"
            icon={SquarePenIcon}
            title={search().trim() ? 'No matching feedback' : 'No feedback yet'}
            body={
              search().trim()
                ? 'Try another word from the title or description.'
                : 'Issues you write or send appear here.'
            }
          />
        }
      >
        <ScrollView
          grow
          shrink
          role="region"
          aria-label="Issues"
          tabIndex={0}
          dataSet={{ testid: 'feedback-issue-scroll' }}
          flushEdge={false}
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
        </ScrollView>
      </Show>
    </StackVertical>
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
      title={props.doc.title || 'Untitled issue'}
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
