import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { type Accessor, createEffect, createSignal } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { useContentAuthorPublication } from './use-content-author-publication';
import { useContentCopyChoice } from './use-content-copy-choice';
import { useContentDraftSave } from './use-content-draft-save';
import { useContentPackEdit } from './use-content-pack-edit';
import { useDraftEditHistory } from './use-draft-edit-history';

/**
 * One draft's builder, for as long as it is open: its saves, edit history,
 * pack operations, publication standing, started playtest and pending
 * confirmations all outlive whichever of the builder's small screens is
 * shown, and a pack change's saved head is adopted before publication.
 */
export function useContentAuthorWorkspace(
  document: Accessor<ContentDocument>,
  initial: Accessor<ContentDraft>
) {
  const data = useContentLibraryState();
  const history = useDraftEditHistory(() => document().id);
  const writer = useContentDraftSave(initial, history.record);
  const [adopting, setAdopting] = createSignal<string | null>(null);
  const packTools = useContentPackEdit({
    get documentId() {
      return document().id;
    },
    writer,
    onSaved: (id) => {
      history.record(writer.draftId(), id);
      setAdopting(id);
    },
  });
  /** Choosing a kept copy is an edit too, so it can be undone. */
  const chooseCopy = (draft: ContentDraft): void => {
    history.record(writer.draftId(), draft.id);
    writer.adopt(draft);
  };
  const copyChoice = useContentCopyChoice({
    get document() {
      return document();
    },
    onChoose: chooseCopy,
  });
  const publication = useContentAuthorPublication(document, writer);
  /** The playtest started in this builder, to open again from any visit. */
  const [playtestId, setPlaytestId] = createSignal<string | null>(null);
  /** The pack puzzle whose removal waits to be confirmed. */
  const [removing, setRemoving] = createSignal<string | null>(null);
  /** Withdrawing the publication waits to be confirmed. */
  const [withdrawing, setWithdrawing] = createSignal(false);
  const packPending = () =>
    packTools.change.loading() || packTools.create.feedback() === 'loading';
  createEffect(() => {
    const draft = data
      .content()
      .drafts.find((entry) => entry.id === adopting());
    if (draft !== undefined) {
      writer.adopt(draft);
      setAdopting(null);
    }
  });
  const disabled = () =>
    writer.saving() || adopting() !== null || packPending();
  const conflicted = () =>
    !writer.saving() && document().working_draft_id !== writer.draftId();
  return {
    writer,
    history,
    copyChoice,
    publication,
    playtestId,
    setPlaytestId,
    removing,
    setRemoving,
    withdrawing,
    setWithdrawing,
    adopting,
    packTools,
    packPending,
    disabled,
    conflicted,
  };
}

export type ContentAuthorWorkspace = ReturnType<
  typeof useContentAuthorWorkspace
>;
