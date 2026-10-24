import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { restartAttemptFor } from './attempt-actions';
import { completeExampleAttempt } from './attempt-fixtures';
import type { ContentHarness } from './content-system';
import { arrangePackFor } from './pack-fixtures';
import {
  continuePackFor,
  openPackFor,
  startPackPuzzleFor,
} from './pack-play-actions';
import { lifecyclePuzzle } from './pack-publication-lifecycle-actions';

export const setupPackProgression = defineAction({
  name: 'setupPackProgression',
  act: async (s: ContentHarness) => {
    await arrangePackFor(s, {
      title: 'Rivers',
      titles: ['River', 'Valley'],
      published: true,
    });
    for (const title of ['River', 'Valley']) {
      const id = s.documents.get(title);
      if (id === undefined) throw new Error('The published pack is incomplete');
      s.lifecyclePuzzles.push(id);
    }
    await openPackFor(s, 'bob:phone', 'Rivers');
  },
});

export const startProgressionPuzzle = defineAction({
  name: 'startProgressionPuzzle',
  act: async (s: ContentHarness, index: number) => {
    const puzzleId = lifecyclePuzzle(s, index);
    const title = [...s.documents.entries()].find(
      ([, id]) => id === puzzleId
    )?.[0];
    if (title === undefined) throw new Error('Choose a puzzle from the pack');
    await startPackPuzzleFor(s, 'bob:phone', title);
  },
});

export const completeProgressionPuzzle = defineAction({
  name: 'completeProgressionPuzzle',
  act: (s: ContentHarness) => completeExampleAttempt(s, 'bob:phone'),
});

export const restartProgressionPuzzle = defineAction({
  name: 'restartProgressionPuzzle',
  act: (s: ContentHarness) => restartAttemptFor(s, 'bob:phone'),
});

export const continueProgressionPack = defineAction({
  name: 'continueProgressionPack',
  act: (s: ContentHarness) => continuePackFor(s, 'bob:phone', 'Rivers'),
});

export const PROGRESSION_LIFECYCLE_ACTIONS = [
  setupPackProgression,
  startProgressionPuzzle,
  completeProgressionPuzzle,
  restartProgressionPuzzle,
  continueProgressionPack,
] as const;
