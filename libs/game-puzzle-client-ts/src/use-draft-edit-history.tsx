import { choosePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createSignal, type Signal } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import {
  type DraftEditDirection,
  type DraftEditHistory,
  draftEditChoices,
  draftEditTarget,
  recordDraftEdit,
  steppedDraftEdit,
} from './draft-edit-history';

type SessionHistories = Signal<ReadonlyMap<string, DraftEditHistory>>;

/** Drafts one app session keeps editing choices for; the least recent is forgotten first. */
const SESSION_DRAFT_LIMIT = 20;

/**
 * Editing choices live only as long as the running sync engine: reopening
 * the app (or switching account) starts another engine and so fresh undo and
 * redo choices, while every kept draft copy remains. Never persisted.
 */
const sessions = new WeakMap<SyncEngine, SessionHistories>();

function sessionHistories(engine: SyncEngine): SessionHistories {
  const existing = sessions.get(engine);
  if (existing !== undefined) return existing;
  const created = createSignal<ReadonlyMap<string, DraftEditHistory>>(
    new Map()
  );
  sessions.set(engine, created);
  return created;
}

/** Undo and redo of one draft's edits during this app session. */
export function useDraftEditHistory(documentId: Accessor<string>) {
  const { t } = useLingui();
  const [histories, setHistories] = sessionHistories(useSyncEngineInstance());
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const update = (
    change: (
      history: DraftEditHistory | undefined
    ) => DraftEditHistory | undefined
  ): void => {
    const id = documentId();
    setHistories((previous) => {
      const next = new Map(previous);
      const value = change(previous.get(id));
      next.delete(id);
      if (value !== undefined) next.set(id, value);
      for (const stale of [...next.keys()].slice(0, -SESSION_DRAFT_LIMIT))
        next.delete(stale);
      return next;
    });
  };
  const record = (from: string, to: string): void => {
    update((history) => recordDraftEdit(history, from, to));
  };
  const choices = (working: string) =>
    draftEditChoices(histories().get(documentId()), working);
  /** Keep a new working copy of the preceding or undone edit; every copy remains. */
  const step = async (
    direction: DraftEditDirection,
    working: string
  ): Promise<ContentDraft> => {
    const target = draftEditTarget(
      histories().get(documentId()),
      working,
      direction
    );
    const source = data.content().drafts.find((draft) => draft.id === target);
    if (source === undefined)
      throw new Error(
        t`That edit is no longer available here. Your kept copies remain below.`
      );
    const draftId = createId();
    const result = await mutations.mutate(choosePuzzleContentDraftMutation, {
      documentId: documentId(),
      chosenDraftId: source.id,
      expectedDraftId: working,
      draftId,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The edit could not be changed. Try again.`
      );
    update((history) => steppedDraftEdit(history, direction, draftId));
    return { ...source, id: draftId, parent_id: working, conflicted: false };
  };
  return { record, choices, step };
}

export type DraftEditHistoryTools = ReturnType<typeof useDraftEditHistory>;
