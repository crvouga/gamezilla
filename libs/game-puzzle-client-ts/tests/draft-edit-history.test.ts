import { expect, test } from 'bun:test';
import {
  DRAFT_EDIT_HISTORY_LIMIT,
  type DraftEditHistory,
  draftEditChoices,
  draftEditTarget,
  recordDraftEdit,
  steppedDraftEdit,
} from '@libs/game-puzzle-client-ts/draft-edit-history';

const edited = (...ids: string[]): DraftEditHistory | undefined =>
  ids
    .slice(1)
    .reduce<DraftEditHistory | undefined>(
      (history, id, index) => recordDraftEdit(history, ids[index] ?? '', id),
      undefined
    );

test('an unchanged draft offers neither undo nor redo', () => {
  expect(draftEditChoices(undefined, 'river')).toEqual({
    undo: false,
    redo: false,
  });
});

test('undo returns to the preceding copy and offers redo of the undone one', () => {
  const history = edited('river', 'valley');
  expect(draftEditChoices(history, 'valley')).toEqual({
    undo: true,
    redo: false,
  });
  expect(draftEditTarget(history, 'valley', 'undo')).toBe('river');
  const undone = steppedDraftEdit(history, 'undo', 'river-again');
  expect(draftEditChoices(undone, 'river-again')).toEqual({
    undo: false,
    redo: true,
  });
  expect(draftEditTarget(undone, 'river-again', 'redo')).toBe('valley');
  const redone = steppedDraftEdit(undone, 'redo', 'valley-again');
  expect(draftEditChoices(redone, 'valley-again')).toEqual({
    undo: true,
    redo: false,
  });
  expect(draftEditTarget(redone, 'valley-again', 'undo')).toBe('river-again');
});

test('a different edit replaces only the redo choice', () => {
  const undone = steppedDraftEdit(
    edited('river', 'valley', 'harbor'),
    'undo',
    'valley-again'
  );
  const replaced = recordDraftEdit(undone, 'valley-again', 'meadow');
  expect(draftEditChoices(replaced, 'meadow')).toEqual({
    undo: true,
    redo: false,
  });
  expect(draftEditTarget(replaced, 'meadow', 'undo')).toBe('valley-again');
});

test('history kept for another working copy offers nothing', () => {
  const history = edited('river', 'valley');
  expect(draftEditChoices(history, 'tablet-copy')).toEqual({
    undo: false,
    redo: false,
  });
  expect(draftEditTarget(history, 'tablet-copy', 'undo')).toBeNull();
  expect(
    draftEditChoices(recordDraftEdit(history, 'tablet-copy', 'next'), 'next')
  ).toEqual({ undo: true, redo: false });
});

test('editing history keeps at most its limit of earlier copies', () => {
  const ids = Array.from(
    { length: DRAFT_EDIT_HISTORY_LIMIT + 5 },
    (_, index) => `copy-${index}`
  );
  let history = edited(...ids);
  let current = ids.at(-1) ?? '';
  let undos = 0;
  while (draftEditChoices(history, current).undo) {
    current = `undo-${undos}`;
    history = steppedDraftEdit(history, 'undo', current);
    undos += 1;
  }
  expect(undos).toBe(DRAFT_EDIT_HISTORY_LIMIT);
});
