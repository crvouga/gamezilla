import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { authoringPuzzleId } from './authoring-lifecycle-actions';
import type { ContentHarness } from './content-system';
import { editPackFor } from './pack-actions';

export const addAuthoringPackPuzzle = defineAction({
  name: 'addAuthoringPackPuzzle',
  act: (s: ContentHarness, puzzle: number) =>
    editPackFor(s, 'alice:phone', {
      kind: 'add',
      puzzleId: authoringPuzzleId(s, puzzle),
    }),
});

export const removeAuthoringPackPuzzle = defineAction({
  name: 'removeAuthoringPackPuzzle',
  act: (s: ContentHarness, puzzle: number) =>
    editPackFor(s, 'alice:phone', {
      kind: 'remove',
      puzzleId: authoringPuzzleId(s, puzzle),
    }),
});

export const reorderAuthoringPackPuzzle = defineAction({
  name: 'reorderAuthoringPackPuzzle',
  act: (s: ContentHarness, puzzle: number, before: number) =>
    editPackFor(s, 'alice:phone', {
      kind: 'move',
      puzzleId: authoringPuzzleId(s, puzzle),
      beforeId: authoringPuzzleId(s, before),
    }),
});

export const PACK_AUTHORING_LIFECYCLE_ACTIONS = [
  addAuthoringPackPuzzle,
  removeAuthoringPackPuzzle,
  reorderAuthoringPackPuzzle,
] as const;
