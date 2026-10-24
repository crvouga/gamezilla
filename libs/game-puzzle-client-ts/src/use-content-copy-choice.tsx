import { choosePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal } from 'solid-js';
import { useContentLibraryState } from './content-library-context';

type Choice = { source: ContentDraft; expected: string; draftId: string };
export function useContentCopyChoice(props: {
  document: ContentDocument;
  onChoose: (draft: ContentDraft) => void;
}) {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [choice, setChoice] = createSignal<Choice | null>(null);
  const select = (id: string): void => {
    const expected = props.document.working_draft_id;
    const source = data
      .content()
      .drafts.find(
        (draft) => draft.id === id && draft.document_id === props.document.id
      );
    if (source !== undefined && expected !== null)
      setChoice({
        source,
        expected,
        draftId: createId(),
      });
  };
  const choose = async (): Promise<void> => {
    const selected = choice();
    if (selected === null) return;
    const result = await mutations.mutate(choosePuzzleContentDraftMutation, {
      documentId: props.document.id,
      chosenDraftId: selected.source.id,
      expectedDraftId: selected.expected,
      draftId: selected.draftId,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The working draft changed. Open the kept copies and choose again.`
      );
    props.onChoose({
      ...selected.source,
      id: selected.draftId,
      parent_id: selected.source.id,
      conflicted: false,
    });
  };
  return {
    visible: () => choice() !== null,
    close: () => setChoice(null),
    select,
    choose,
  };
}
