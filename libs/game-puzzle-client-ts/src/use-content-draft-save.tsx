import {
  type ContentBody,
  type ContentDraft,
  contentBody,
} from '@libs/game-puzzle-shared-ts/content-types';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, onCleanup, untrack } from 'solid-js';

type KeptDraft = {
  body: ContentBody;
  draftId: string;
  dirty: boolean;
};

/**
 * The working copy as the screen shows it (signals) beside the same values
 * as last set (`kept`): the saving loop reads straight after a change,
 * before the signals show it.
 */
function createKeptDraft(seed: ContentDraft) {
  const kept: KeptDraft = {
    body: contentBody(seed),
    draftId: seed.id,
    dirty: false,
  };
  const [body, setBody] = createSignal<ContentBody>(kept.body);
  const [draftId, setDraftId] = createSignal(kept.draftId);
  const [dirty, setDirty] = createSignal(kept.dirty);
  const keep = (next: Partial<KeptDraft>): void => {
    Object.assign(kept, next);
    setBody(kept.body);
    setDraftId(kept.draftId);
    setDirty(kept.dirty);
  };
  return { body, draftId, dirty, kept, keep };
}

/**
 * Serial saves coalesce edits and retain the local body when persistence
 * refuses. `onSaved` hears each kept copy and the working copy it followed.
 */
export function useContentDraftSave(
  initial: () => ContentDraft,
  onSaved: (from: string, to: string) => void
) {
  const { t } = useLingui();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const seed = untrack(initial);
  const { body, draftId, dirty, kept, keep } = createKeptDraft(seed);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let active: Promise<void> | null = null;
  // A confirmed departure abandons the edits in flight; editing again in a
  // builder that stayed open resumes saving. Disposal stops it for good.
  let abandoned = false;
  let disposed = false;
  const drain = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      while (kept.dirty && !abandoned && !disposed) {
        const value = kept.body;
        const parentId = kept.draftId;
        const nextId = createId();
        const result = await mutations.mutate(savePuzzleContentDraftMutation, {
          documentId: seed.document_id,
          parentId,
          draftId: nextId,
          body: value,
        });
        if (!result.ok)
          throw new Error(
            result.failures[0]?.message ??
              t`The draft could not be saved. Try saving again.`
          );
        onSaved(parentId, nextId);
        keep({ draftId: nextId, dirty: kept.body !== value });
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t`The draft could not be saved. Try saving again.`
      );
    } finally {
      setSaving(false);
      active = null;
    }
  };
  const save = (): Promise<void> => {
    if (!kept.dirty) return active ?? Promise.resolve();
    active ??= drain();
    return active;
  };
  const change = (next: ContentBody): void => {
    if (JSON.stringify(next) === JSON.stringify(kept.body)) return;
    keep({ body: next, dirty: true });
    abandoned = false;
    void save();
  };
  const adopt = (draft: ContentDraft): void => {
    keep({ body: contentBody(draft), draftId: draft.id, dirty: false });
    setError(null);
  };
  usePendingOperation(
    () => dirty() || saving(),
    () => {
      abandoned = true;
    }
  );
  onCleanup(() => {
    disposed = true;
  });
  return { body, draftId, saving, dirty, error, change, save, adopt };
}
