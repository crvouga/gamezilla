import {
  type ContentBody,
  type ContentDraft,
  contentBody,
} from '@libs/game-puzzle-shared-ts/content-types';
import {
  closeDraftEditStep,
  type DraftEditHistory,
  FRESH_DRAFT_EDIT_HISTORY,
  recordDraftEdit,
  redoDraftEdit,
  undoDraftEdit,
} from '@libs/game-puzzle-shared-ts/draft-edit-history';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, onCleanup, untrack } from 'solid-js';

/** Undo and redo over the bodies a builder showed; they end when it closes. */
function createDraftEditing(io: {
  readonly body: () => ContentBody;
  readonly show: (next: ContentBody) => void;
  readonly replace: (draft: ContentDraft) => void;
}) {
  const [history, setHistory] = createSignal<DraftEditHistory>(
    FRESH_DRAFT_EDIT_HISTORY
  );
  const step = (move: typeof undoDraftEdit): void => {
    const moved = move(history(), io.body());
    if (moved === null) return;
    setHistory(moved.history);
    io.show(moved.body);
  };
  return {
    change: (next: ContentBody): void => {
      const current = io.body();
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      setHistory((past) => recordDraftEdit(past, current, next));
      io.show(next);
    },
    /** `edit` keeps the choice undoable, as a pack change saved elsewhere is. */
    adopt: (draft: ContentDraft, kind: 'edit' | 'replace'): void => {
      const next = contentBody(draft);
      setHistory((past) =>
        kind === 'edit'
          ? closeDraftEditStep(recordDraftEdit(past, io.body(), next))
          : FRESH_DRAFT_EDIT_HISTORY
      );
      io.replace(draft);
    },
    settled: (): void => {
      setHistory(closeDraftEditStep);
    },
    canUndo: () => history().earlier.length > 0,
    canRedo: () => history().undone.length > 0,
    undo: () => step(undoDraftEdit),
    redo: () => step(redoDraftEdit),
  };
}

/**
 * Serial saves coalesce edits and retain the local body when persistence
 * refuses. Every undo or redo is saved as another kept draft copy; the
 * choices last until the builder closes.
 */
export function useContentDraftSave(initial: () => ContentDraft) {
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
        const nextId = createId();
        const result = await mutations.mutate(savePuzzleContentDraftMutation, {
          documentId: seed.document_id,
          parentId: draftId(),
          draftId: nextId,
          body: value,
        });
        if (!result.ok)
          throw new Error(
            result.failures[0]?.message ??
              t`The draft could not be saved. Try saving again.`
          );
        setDraftId(nextId);
        setDirty(body() !== value);
      }
      editing.settled();
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
  const editing = createDraftEditing({
    body,
    show: (next) => {
      setBody(next);
      setDirty(true);
      void save();
    },
    replace: (draft) => {
      setBody(contentBody(draft));
      setDraftId(draft.id);
      setDirty(false);
      setError(null);
    },
  });
  usePendingOperation(
    () => dirty() || saving(),
    () => {
      live = false;
    }
  );
  onCleanup(() => {
    live = false;
  });
  return { body, draftId, saving, dirty, error, save, ...editing };
}
