import {
  type ContentBody,
  type ContentDraft,
  contentBody,
} from '@libs/game-puzzle-shared-ts/content-types';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, onCleanup, untrack } from 'solid-js';

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
  const [body, setBody] = createSignal<ContentBody>(contentBody(seed));
  const [draftId, setDraftId] = createSignal(seed.id);
  const [saving, setSaving] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let active: Promise<void> | null = null;
  let live = true;
  const drain = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      while (dirty() && live) {
        const value = body();
        const parentId = draftId();
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
        setDraftId(nextId);
        setDirty(body() !== value);
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
    if (!dirty()) return active ?? Promise.resolve();
    active ??= drain();
    return active;
  };
  const change = (next: ContentBody): void => {
    if (JSON.stringify(next) === JSON.stringify(body())) return;
    setBody(next);
    setDirty(true);
    void save();
  };
  const adopt = (draft: ContentDraft): void => {
    setBody(contentBody(draft));
    setDraftId(draft.id);
    setDirty(false);
    setError(null);
  };
  usePendingOperation(
    () => dirty() || saving(),
    () => {
      live = false;
    }
  );
  onCleanup(() => {
    live = false;
  });
  return { body, draftId, saving, dirty, error, change, save, adopt };
}
