import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { type Accessor, createEffect, createSignal } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { useContentDraftSave } from './use-content-draft-save';
import { useContentPackEdit } from './use-content-pack-edit';
import { useDraftEditHistory } from './use-draft-edit-history';

/** Keep pack operations alive across preview and adopt their saved head before publication. */
export function useContentAuthorWorkspace(
  document: Accessor<ContentDocument>,
  initial: Accessor<ContentDraft>
) {
  const data = useContentLibraryState();
  const history = useDraftEditHistory(() => document().id);
  const writer = useContentDraftSave(initial, history.record);
  const [preview, setPreview] = createSignal(false);
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
    chooseCopy,
    preview,
    setPreview,
    adopting,
    packTools,
    packPending,
    disabled,
    conflicted,
  };
}
