/**
 * One draft's editing choices during one app session, as draft copy ids.
 * Every edit and every undo or redo keeps a new copy, so stepping back never
 * deletes work: undo makes a new working copy from the preceding one, redo
 * from the undone one. The history describes the working copy `current`
 * only; when another copy becomes the working draft, it offers nothing.
 */
export type DraftEditHistory = {
  readonly current: string;
  readonly earlier: readonly string[];
  readonly undone: readonly string[];
};

export type DraftEditDirection = 'undo' | 'redo';

/** Earlier copies kept per draft; older choices are forgotten first. */
export const DRAFT_EDIT_HISTORY_LIMIT = 50;

/** The edit from working copy `from` kept the new working copy `to`. */
export function recordDraftEdit(
  history: DraftEditHistory | undefined,
  from: string,
  to: string
): DraftEditHistory {
  if (from === to) return history ?? { current: to, earlier: [], undone: [] };
  const earlier = history?.current === from ? history.earlier : [];
  return {
    current: to,
    earlier: [...earlier, from].slice(-DRAFT_EDIT_HISTORY_LIMIT),
    undone: [],
  };
}

export function draftEditChoices(
  history: DraftEditHistory | undefined,
  working: string
): { readonly undo: boolean; readonly redo: boolean } {
  const known = history?.current === working;
  return {
    undo: known && (history?.earlier.length ?? 0) > 0,
    redo: known && (history?.undone.length ?? 0) > 0,
  };
}

/** The kept copy that undo or redo makes the working draft again, if offered. */
export function draftEditTarget(
  history: DraftEditHistory | undefined,
  working: string,
  direction: DraftEditDirection
): string | null {
  if (history?.current !== working) return null;
  return (
    (direction === 'undo' ? history.earlier : history.undone).at(-1) ?? null
  );
}

/** Undo or redo kept `copy` as the new working draft. */
export function steppedDraftEdit(
  history: DraftEditHistory | undefined,
  direction: DraftEditDirection,
  copy: string
): DraftEditHistory | undefined {
  if (history === undefined) return undefined;
  return direction === 'undo'
    ? {
        current: copy,
        earlier: history.earlier.slice(0, -1),
        undone: [...history.undone, history.current],
      }
    : {
        current: copy,
        earlier: [...history.earlier, history.current],
        undone: history.undone.slice(0, -1),
      };
}
