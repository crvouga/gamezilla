import type { ContentBody } from './content-types';

/** Undo and redo of one editing session; reopening begins a fresh one. */
export type DraftEditHistory = {
  readonly earlier: readonly ContentBody[];
  readonly undone: readonly ContentBody[];
  /** A text field whose edits still join the last undo step. */
  readonly open: TextField | null;
};

type TextField = 'title' | 'description' | 'difficulty';

/** Bounds memory for one session; the oldest choices go first. */
export const DRAFT_EDIT_HISTORY_LIMIT = 100;

export const FRESH_DRAFT_EDIT_HISTORY: DraftEditHistory = {
  earlier: [],
  undone: [],
  open: null,
};

function same(a: ContentBody, b: ContentBody): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.difficulty === b.difficulty &&
    a.definition === b.definition
  );
}

/** The one text field an edit changed, if that is all it changed. */
function textField(from: ContentBody, to: ContentBody): TextField | null {
  if (from.definition !== to.definition) return null;
  const changed = (['title', 'description', 'difficulty'] as const).filter(
    (field) => from[field] !== to[field]
  );
  return changed.length === 1 ? (changed[0] ?? null) : null;
}

/**
 * A different body adds an undo step and removes redo. Consecutive edits of
 * one text field join a single step until `closeDraftEditStep` (its save
 * settled), so typing a word is one step. An unchanged body adds nothing.
 */
export function recordDraftEdit(
  history: DraftEditHistory,
  current: ContentBody,
  next: ContentBody
): DraftEditHistory {
  if (same(current, next)) return history;
  const field = textField(current, next);
  const joins =
    field !== null && field === history.open && history.earlier.length > 0;
  return {
    earlier: joins
      ? history.earlier
      : [...history.earlier, current].slice(-DRAFT_EDIT_HISTORY_LIMIT),
    undone: [],
    open: field,
  };
}

export function closeDraftEditStep(
  history: DraftEditHistory
): DraftEditHistory {
  return history.open === null ? history : { ...history, open: null };
}

export function undoDraftEdit(
  history: DraftEditHistory,
  current: ContentBody
): { readonly history: DraftEditHistory; readonly body: ContentBody } | null {
  const body = history.earlier.at(-1);
  if (body === undefined) return null;
  return {
    body,
    history: {
      earlier: history.earlier.slice(0, -1),
      undone: [...history.undone, current],
      open: null,
    },
  };
}

export function redoDraftEdit(
  history: DraftEditHistory,
  current: ContentBody
): { readonly history: DraftEditHistory; readonly body: ContentBody } | null {
  const body = history.undone.at(-1);
  if (body === undefined) return null;
  return {
    body,
    history: {
      earlier: [...history.earlier, current],
      undone: history.undone.slice(0, -1),
      open: null,
    },
  };
}
